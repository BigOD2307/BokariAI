import type { SearchDocument, SearchProvider, SearchQueryOptions } from './types';
import { SearxngProvider } from './providers/searxng';
import { SerperProvider } from './providers/serper';
import { TinyFishProvider } from './providers/tinyfish';

export * from './types';

const RRF_K = 60;
/** Below this, a provider's answer is treated as a miss and the chain continues. */
const MIN_USEFUL_RESULTS = 5;

const searxng = new SearxngProvider();
const serper = new SerperProvider();
const tinyfish = new TinyFishProvider();

/** African news domains, boosted in ranking — Bokari's core positioning is
 *  African coverage, and generic RRF alone has no notion of that. Ported
 *  from the old src/lib/search.ts (same list, same reasoning). */
const AFRICAN_DOMAINS = new Set([
  'rfi.fr', 'france24.com', 'jeuneafrique.com', 'africanews.com',
  'allafrica.com', 'theafricareport.com', 'africanarguments.org',
  'maliactu.net', 'maliweb.net', 'bamada.net', 'journaldumali.com',
  'abamako.com', 'malijet.com',
  'seneweb.com', 'dakaractu.com', 'lequotidien.sn', 'pressafrik.com',
  'koaci.com', 'fratmat.info', 'abidjan.net', 'connectionivoirienne.net',
  'guineenews.org', 'guinee360.com', 'mosaiqueguinee.com',
  'burkina24.com', 'lefaso.net', 'lobs.bf',
  'nigerdiaspora.net', 'actuniger.com',
  'lnc-news.com', 'journalducameroun.com', 'camernews.com',
  'congopage.com', 'actualite.cd', 'radiookapi.net',
  'punchng.com', 'premiumtimesng.com', 'thenationonlineng.net', 'guardian.ng',
  'nation.africa', 'standardmedia.co.ke', 'monitor.co.ug',
  'reuters.com', 'bbc.com', 'lemonde.fr', 'apnews.com',
]);

/** Same scale as the old implementation: one engine's rank-1 RRF contribution
 *  is ~1/61 ≈ 0.0164, so 1/600 makes the African-domain boost worth roughly
 *  one extra rank-1 provider appearance — a first-class signal that still
 *  can't override strong cross-provider consensus. */
const DOMAIN_BOOST_SCALE = 1 / 600;

/**
 * Provider order depends on intent.
 *
 * - News wants a real per-result date, which only Serper returns — it leads
 *   despite costing money. TinyFish is free but never dates a result.
 * - General queries are free from either SearXNG (local) or TinyFish (a real
 *   API, not a scraper); Serper is the paid last resort.
 * - Academic has exactly one honest provider: TinyFish's `research_paper`
 *   domain type. Neither Serper nor SearXNG index academic papers as such —
 *   pretending otherwise (the old `engines: ['arxiv', …]`, silently ignored
 *   by the dispatcher) is worse than not having the feature (BUG-27).
 */
function chainFor(intent: SearchQueryOptions['intent']): SearchProvider[] {
  const chain =
    intent === 'news'
      ? [serper, tinyfish, searxng]
      : intent === 'academic'
        ? [tinyfish]
        : [searxng, tinyfish, serper];
  return chain.filter((p) => p.isConfigured());
}

export type SearchOutcome = {
  documents: SearchDocument[];
  /** Providers that actually answered, in order. Empty means total failure. */
  used: string[];
  /** Providers that threw or returned nothing, with the reason. Never silent. */
  failures: Array<{ provider: string; reason: string }>;
};

export async function searchWeb(
  query: string,
  opts: SearchQueryOptions,
): Promise<SearchOutcome> {
  const lists: SearchDocument[][] = [];
  const used: string[] = [];
  const failures: SearchOutcome['failures'] = [];

  for (const provider of chainFor(opts.intent)) {
    try {
      const docs = await provider.search(query, opts);
      if (docs.length > 0) {
        lists.push(docs);
        used.push(provider.name);
      } else {
        failures.push({ provider: provider.name, reason: 'empty' });
      }
      // Stop as soon as we have enough from the providers that answered.
      if (lists.reduce((n, l) => n + l.length, 0) >= MIN_USEFUL_RESULTS) break;
    } catch (err) {
      failures.push({ provider: provider.name, reason: (err as Error).message });
    }
  }

  if (failures.length > 0) {
    console.warn('[Bokari retrieval] provider failures', { query, failures });
  }

  return { documents: fuse(lists, opts.limit), used, failures };
}

function africanDomainBoost(domain: string): number {
  return AFRICAN_DOMAINS.has(domain) ? DOMAIN_BOOST_SCALE : 0;
}

/**
 * Reciprocal Rank Fusion across providers, deduplicating on canonical URL,
 * with an African-domain tie-breaking boost folded in.
 *
 * Unlike the previous implementation, the same document coming from two
 * providers genuinely means two independent providers ranked it — the old
 * "DDG News" was the same endpoint as "DDG web" with a different query
 * parameter, so consensus was an illusion (BUG-22).
 */
export function fuse(lists: SearchDocument[][], limit: number): SearchDocument[] {
  const fused = new Map<
    string,
    { doc: SearchDocument; score: number; providers: Set<string> }
  >();

  for (const list of lists) {
    list.forEach((doc, index) => {
      const existing = fused.get(doc.canonicalUrl);
      const contribution = 1 / (RRF_K + index + 1);

      if (!existing) {
        fused.set(doc.canonicalUrl, {
          doc,
          score: contribution + africanDomainBoost(doc.domain),
          providers: new Set([doc.provider]),
        });
        return;
      }

      // Same provider twice = a duplicate inside one list, not consensus.
      if (!existing.providers.has(doc.provider)) {
        existing.score += contribution;
        existing.providers.add(doc.provider);
      }
      // Keep the richest metadata seen for this URL.
      if (doc.snippet.length > existing.doc.snippet.length) existing.doc.snippet = doc.snippet;
      if (!existing.doc.publishedAt && doc.publishedAt) existing.doc.publishedAt = doc.publishedAt;
    });
  }

  return [...fused.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.doc);
}
