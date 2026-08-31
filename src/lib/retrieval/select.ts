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
import type { SearchAgentConfig } from '@/lib/agents/search/types';

export type SelectionBudget = {
  /** Hard cap on the tokens the evidence block may occupy in the writer prompt. */
  maxTokens: number;
  /** Candidates handed to the cross-encoder. Above ~50 the latency shows. */
  rerankPoolSize: number;
  maxPerDomain: number;
  maxPassages: number;
};

export const DEFAULT_BUDGET: Record<SearchAgentConfig['mode'], SelectionBudget> = {
  speed: { maxTokens: 4_000, rerankPoolSize: 25, maxPerDomain: 2, maxPassages: 8 },
  balanced: { maxTokens: 8_000, rerankPoolSize: 40, maxPerDomain: 2, maxPassages: 12 },
  quality: { maxTokens: 16_000, rerankPoolSize: 60, maxPerDomain: 3, maxPassages: 20 },
  learn: { maxTokens: 6_000, rerankPoolSize: 25, maxPerDomain: 2, maxPassages: 10 },
};

const AFRICAN_BOOST = 1.25;
/** Half-life for evidence selection: a week, not the 3-day default of the
 *  Discover feed — an answer may legitimately rest on last month's report. */
const HALF_LIFE_MS = 7 * 86_400_000;
const UNDATED_FRESHNESS = 0.6;

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
): Promise<Chunk[]> {
  if (chunks.length === 0) return [];

  const tokenizedDocs = chunks.map((c) => tokenize(c.content ?? ''));
  const { idf, avgdl } = buildBM25Index(tokenizedDocs);
  const queryTokens = tokenize(query);

  const candidates = chunks.map((chunk, i) => {
    const meta = (chunk.metadata ?? {}) as Record<string, unknown>;
    const publishedAtRaw = meta.publishedAt;
    const publishedAt =
      typeof publishedAtRaw === 'string' && publishedAtRaw ? new Date(publishedAtRaw) : null;
    return {
      chunk,
      domain: domainOf(typeof meta.url === 'string' ? meta.url : ''),
      publishedAt: publishedAt && !Number.isNaN(publishedAt.getTime()) ? publishedAt : null,
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
  //    today's dispatch on lexical overlap alone.
  const scored: Candidate[] = candidates.map((c) => {
    const freshness = c.publishedAt
      ? freshnessScore(ageMs(c.publishedAt, now), HALF_LIFE_MS)
      : UNDATED_FRESHNESS; // unknown date: neither rewarded nor buried
    const authority = isAfricanDomain(c.domain) ? AFRICAN_BOOST : 1;
    const lexical = discriminates ? c.lexicalScore : 1;
    return { ...c, score: lexical * freshness * authority };
  });

  scored.sort((a, b) => b.score - a.score);

  // 2. Diversity cap before the reranker, so the pool we pay for is varied.
  const diverse = applyDiversityCap(scored, budget.maxPerDomain).slice(0, budget.rerankPoolSize);

  // 3. Cross-encoder. Optional by design: when it is off or fails, the
  //    lexical order stands and the answer is merely less well ordered,
  //    never absent.
  let ordered: Candidate[] = diverse;
  const rerankConfig = getRerankConfig();
  if (rerankConfig.enabled && diverse.length > budget.maxPassages) {
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
