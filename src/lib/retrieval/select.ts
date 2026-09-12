/**
 * Turn a pile of search-agent Chunks into the evidence the writer, chart
 * extractor, rich-block extractor and faithfulness gate actually see.
 *
 * Adapted from the guide's `Passage[]` + `Map<SearchDocument>` design to the
 * currency this codebase's researcher loop actually produces:
 * `ResearcherOutput.searchFindings` is already every `search_results` Chunk
 * from every action across every iteration, deduped by URL
 * (researcher/index.ts). The bug was never a loss of data — it was
 * `.slice(0, MAX_WRITER_RESULTS)` on that list in ARRIVAL order (BUG-19):
 * the first 8 results of the fastest first-turn query, not the 8 best. Deep
 * research (35 iterations) spent 35x the LLM budget producing context the
 * writer then never read, because turns 2-35 land past index 8.
 *
 * Ordering is by usefulness, never by arrival.
 */
import { getEncoding } from 'js-tiktoken';
import { applyDiversityCap } from '@/lib/discover/diversity';
import { ageMs, freshnessScore } from '@/lib/discover/freshness';
import { isAfricanDomain } from '@/lib/discover/domainLists';
import { getRerankConfig, getReranker } from '@/lib/ai/reranker';
import { tokenize, buildBM25Index, bm25Score } from '@/lib/discover/bm25';
import { domainOf } from './url';
import type { Chunk } from '@/lib/types';
import type {
  SearchAgentConfig,
  SearchFocus,
} from '@/lib/agents/search/types';

export type SelectionBudget = {
  /** Hard cap on the tokens the evidence block may occupy in the writer prompt. */
  maxTokens: number;
  /** Candidates handed to the cross-encoder. Above ~50 the latency shows. */
  rerankPoolSize: number;
  maxPerDomain: number;
  maxPassages: number;
};

export const DEFAULT_BUDGET: Record<
  SearchAgentConfig['mode'],
  SelectionBudget
> = {
  // speed: rerankPoolSize 0 = skip the cross-encoder (a 300-800ms round-trip
  // for a reordering BM25+freshness already approximates — latency is the
  // product in speed mode).
  speed: {
    maxTokens: 4_000,
    rerankPoolSize: 0,
    maxPerDomain: 2,
    maxPassages: 8,
  },
  balanced: {
    maxTokens: 8_000,
    rerankPoolSize: 40,
    maxPerDomain: 2,
    maxPassages: 12,
  },
  quality: {
    maxTokens: 16_000,
    rerankPoolSize: 60,
    maxPerDomain: 3,
    maxPassages: 20,
  },
  learn: {
    maxTokens: 6_000,
    rerankPoolSize: 25,
    maxPerDomain: 2,
    maxPassages: 10,
  },
  // eco: the 3G mode — minimal context (5 short passages), no reranker, one
  // source per domain. The answer streams fast and costs the least.
  eco: {
    maxTokens: 2_000,
    rerankPoolSize: 0,
    maxPerDomain: 1,
    maxPassages: 5,
  },
};

const AFRICAN_BOOST = 1.25;
/**
 * Corpus boost: hits from our own news corpus (C9 — full text read with
 * Readability, real publication date, vetted outlet) carry more signal than
 * a web snippet of equal lexical overlap, so they rank above it.
 */
const CORPUS_BOOST = 1.2;
/** Tier-1 corpus outlets (news agency, IFCN/JTI-certified) get a further lift. */
const CORPUS_TIER1_BOOST = 1.15;
/** Half-life for evidence selection: a week, not the 3-day default of the
 *  Discover feed — an answer may legitimately rest on last month's report. */
const HALF_LIFE_MS = 7 * 86_400_000;
const UNDATED_FRESHNESS = 0.6;

/**
 * Focus ranking knobs — the deterministic half of focus modes (the other
 * half is the researcher briefing in prompts/search/focus.ts). Same
 * multiplicative philosophy as the base score: bounded boosts, never a
 * filter, so a brilliant off-focus source can still win on lexical merit.
 */
type FocusKnobs = {
  /** Freshness half-life: short for news, long for timeless procedures. */
  halfLifeMs: number;
  /** Freshness value for undated sources under this focus. */
  undatedFreshness: number;
  /** Extra multiplier on corpus hits (presse africaine vetted). */
  corpusMult: number;
  /** Multiplier for official domains (governments, institutions). */
  officialBoost: number;
  /**
   * Freshness floor for official domains: procedures stay citable even when
   * old (a 2024 .gouv page beats yesterday's blog). 0 = no floor.
   */
  officialFloor: number;
  /** Per-digit-group lift cap for figure-dense content (prices, stats). */
  numericLift: number;
};

const FOCUS_RANKING: Record<Exclude<SearchFocus, 'auto'>, FocusKnobs> = {
  // News: 2-day half-life — yesterday's dispatch must beat last month's
  // analysis. Undated web pages are suspect for news.
  actu: {
    halfLifeMs: 2 * 86_400_000,
    undatedFreshness: 0.4,
    corpusMult: 1.25,
    officialBoost: 1,
    officialFloor: 0,
    numericLift: 0,
  },
  // Prices/figures: a figure-dense page (tables, prices) outranks prose;
  // undated figures are dangerous, bury them harder than the default.
  marches: {
    halfLifeMs: HALF_LIFE_MS,
    undatedFreshness: 0.4,
    corpusMult: 1,
    officialBoost: 1,
    officialFloor: 0,
    numericLift: 0.05,
  },
  // Procedures: official sources win; procedures are timeless (a 2024
  // .gouv page beats yesterday's blog). Numeric lift 0: a tariff table is
  // nice but officialness decides.
  demarches: {
    halfLifeMs: 180 * 86_400_000,
    undatedFreshness: UNDATED_FRESHNESS,
    corpusMult: 1,
    officialBoost: 1.5,
    officialFloor: 0.7,
    numericLift: 0,
  },
  // Exams: official education sources win; calendars age slowly. The floor
  // is high (0.8): last year's official calendar remains the best template
  // until replaced — the writer cross-checks the dates, ranking keeps it
  // visible.
  examens: {
    halfLifeMs: 90 * 86_400_000,
    undatedFreshness: 0.5,
    corpusMult: 1,
    officialBoost: 1.35,
    officialFloor: 0.8,
    numericLift: 0,
  },
};

/** Governments, public services and major African institutions. */
const OFFICIAL_DOMAIN_RE =
  /(^|\.)gouv\.|\.gov(\.|$)|service-public|education\.|unesco\.org|worldbank\.org|afdb\.org|au\.int|cedeao|uemoa/i;

export function isOfficialDomain(domain: string): boolean {
  return OFFICIAL_DOMAIN_RE.test(domain);
}

/**
 * Bounded lift for figure-dense content: +numericLift per digit group,
 * capped at +40%. "250 FCFA/kg à Bamako, 275 à Ségou" (2 groups) outranks
 * prose with the same words; a phone-number dump cannot run away.
 */
export function numericBoost(content: string, liftPerGroup: number): number {
  if (liftPerGroup <= 0) return 1;
  const groups = (content.match(/\d[\d\s.,]*/g) ?? []).length;
  return 1 + Math.min(0.4, groups * liftPerGroup);
}

let encoder: ReturnType<typeof getEncoding> | null = null;
function countTokens(text: string): number {
  // js-tiktoken is already a dependency (src/lib/utils/splitText.ts uses the
  // same encoding). cl100k is close enough across GPT/Llama/DeepSeek
  // tokenisers for budgeting purposes.
  if (!encoder) encoder = getEncoding('cl100k_base');
  return encoder.encode(text).length;
}

type Candidate = {
  chunk: Chunk;
  domain: string;
  publishedAt: Date | null;
  lexicalScore: number;
  score: number;
};

/**
 * @param chunks All `search_results` Chunks accumulated across the whole
 *   research session (ResearcherOutput.searchFindings — already deduped by
 *   URL). May come from web, academic, social or YouTube actions; whichever
 *   text is in `.content` is scored uniformly.
 * @param query Relevance query — pass the classifier's `standaloneFollowUp`,
 *   not the raw follow-up, so a pronoun-laden turn still scores correctly.
 */
export async function selectEvidence(
  chunks: Chunk[],
  query: string,
  budget: SelectionBudget,
  now: Date = new Date(),
  focus: SearchFocus = 'auto',
): Promise<Chunk[]> {
  if (chunks.length === 0) return [];

  const tokenizedDocs = chunks.map((c) => tokenize(c.content ?? ''));
  const { idf, avgdl } = buildBM25Index(tokenizedDocs);
  const queryTokens = tokenize(query);

  const candidates = chunks.map((chunk, i) => {
    const meta = (chunk.metadata ?? {}) as Record<string, unknown>;
    const publishedAtRaw = meta.publishedAt;
    const publishedAt =
      typeof publishedAtRaw === 'string' && publishedAtRaw
        ? new Date(publishedAtRaw)
        : null;
    return {
      chunk,
      domain: domainOf(typeof meta.url === 'string' ? meta.url : ''),
      publishedAt:
        publishedAt && !Number.isNaN(publishedAt.getTime())
          ? publishedAt
          : null,
      lexicalScore: bm25Score(queryTokens, tokenizedDocs[i], idf, avgdl),
    };
  });

  // BM25 IDF degenerates on a small, already-query-filtered corpus (see
  // src/lib/retrieval/passages.ts for the same reasoning): if nothing
  // discriminates lexically, don't let every candidate collapse to the same
  // near-zero score — fall back to freshness/authority alone.
  const discriminates = candidates.some((c) => c.lexicalScore > 0);

  // 1. Lexical score modulated by freshness and source authority.
  //    Multiplicative on purpose: a two-year-old page should not outrank
  //    today's dispatch on lexical overlap alone. A user-chosen focus
  //    adjusts the knobs (half-life, official boost, figure lift) without
  //    changing the formula — 'auto' reproduces the legacy score exactly.
  const knobs = focus === 'auto' ? null : FOCUS_RANKING[focus];
  const scored: Candidate[] = candidates.map((c) => {
    const isOfficial = isOfficialDomain(c.domain);
    let freshness = c.publishedAt
      ? freshnessScore(ageMs(c.publishedAt, now), knobs?.halfLifeMs ?? HALF_LIFE_MS)
      : (knobs?.undatedFreshness ?? UNDATED_FRESHNESS); // unknown date: neither rewarded nor buried
    // Official procedures stay citable: the floor keeps a 2024 .gouv page
    // above yesterday's blog (a floor, not immunity — brilliant fresh
    // content can still win on lexical merit).
    if (knobs && isOfficial && knobs.officialFloor > 0) {
      freshness = Math.max(freshness, knobs.officialFloor);
    }
    const authority = isAfricanDomain(c.domain) ? AFRICAN_BOOST : 1;
    const official = knobs && isOfficial ? knobs.officialBoost : 1;
    // Corpus hits (C9) outrank web snippets at equal overlap; tier-1
    // corpus outlets (agency / IFCN-JTI-certified) outrank the rest.
    const meta = (c.chunk.metadata ?? {}) as Record<string, unknown>;
    const fromCorpus = meta.fromCorpus === true;
    const corpusBoost =
      (fromCorpus
        ? CORPUS_BOOST * (meta.sourceTier === 1 ? CORPUS_TIER1_BOOST : 1)
        : 1) * (knobs && fromCorpus ? knobs.corpusMult : 1);
    const figures = knobs
      ? numericBoost(c.chunk.content ?? '', knobs.numericLift)
      : 1;
    const lexical = discriminates ? c.lexicalScore : 1;
    return {
      ...c,
      score: lexical * freshness * authority * official * corpusBoost * figures,
    };
  });

  scored.sort((a, b) => b.score - a.score);

  // 2. Diversity cap. Pool size: rerankPoolSize, except when reranking is
  //    disabled for this mode (rerankPoolSize 0) — then the pool is the
  //    passage budget, since the lexical order IS the final order.
  const poolSize =
    budget.rerankPoolSize > 0 ? budget.rerankPoolSize : budget.maxPassages;
  const diverse = applyDiversityCap(scored, budget.maxPerDomain).slice(
    0,
    Math.max(1, poolSize),
  );

  // 3. Cross-encoder. Optional by design: when it is off or fails, the
  //    lexical order stands and the answer is merely less well ordered,
  //    never absent. Speed mode skips it entirely: the reranker costs a
  //    network round-trip (300-800ms) for a reordering the lexical+freshness
  //    score already approximates — latency is the product in speed mode.
  let ordered: Candidate[] = diverse;
  const rerankConfig = getRerankConfig();
  if (
    rerankConfig.enabled &&
    budget.rerankPoolSize > 0 && // 0 = rerank disabled for this mode
    diverse.length > budget.maxPassages
  ) {
    try {
      // The API is getReranker(mode) + .rank(query, docs, topN) — see
      // src/lib/ai/reranker.ts before changing this call.
      const reranker = getReranker('live');
      const ranked = await reranker.rank(
        query,
        diverse.map((c, i) => ({
          id: String(i),
          text: `${(c.chunk.metadata?.title as string) ?? ''}\n${c.chunk.content}`,
        })),
        budget.maxPassages,
      );
      const reordered = ranked
        .map((r) => diverse[Number(r.id)])
        .filter((c): c is Candidate => Boolean(c));
      if (reordered.length > 0) ordered = reordered;
    } catch (err) {
      console.warn('[Bokari retrieval] rerank failed, keeping lexical order', {
        error: (err as Error).message,
      });
    }
  }

  // 4. Fill until the token budget is spent.
  const kept: Chunk[] = [];
  let tokens = 0;
  for (const candidate of ordered) {
    if (kept.length >= budget.maxPassages) break;
    const cost = countTokens(candidate.chunk.content ?? '') + 40; // ~40 tokens of source header
    if (tokens + cost > budget.maxTokens) continue; // skip, do not stop: a
    // short passage further down may still fit.
    kept.push(candidate.chunk);
    tokens += cost;
  }

  return kept;
}
