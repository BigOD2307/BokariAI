import type { SearchDocument, SearchProvider, SearchQueryOptions } from '../types';
import { canonicalizeUrl, domainOf } from '../url';

const ENDPOINT = 'https://api.search.tinyfish.ai';
const TIMEOUT_MS = 8_000;

type TinyFishItem = {
  position?: number;
  site_name?: string;
  title?: string;
  snippet?: string;
  url?: string;
};

type TinyFishResponse = {
  results?: TinyFishItem[];
};

/**
 * TinyFish Search API (docs.tinyfish.ai/search-api, verified 2026-08-31).
 * Search is free at any account balance — "never draws from your wallet" —
 * so this costs nothing to keep ahead of Serper for general queries, and as
 * a free layer before paying for Serper on news. Its one real limitation:
 * the response never carries a per-result date (only a `domain_type=news`
 * category and `after_date`/`before_date`/`recency_minutes` filters), which
 * is why Serper — not TinyFish — leads the news chain when a dated citation
 * matters.
 *
 * `domain_type=research_paper` (with `pub_year_min/max`) is also the fix for
 * the fake "academic search" (BUG-27): it used to pass `engines:
 * ['arxiv','google scholar','pubmed']` to a dispatcher that silently ignored
 * them and ran a plain web search.
 */
export class TinyFishProvider implements SearchProvider {
  readonly name = 'tinyfish';

  isConfigured(): boolean {
    return Boolean(process.env.TINYFISH_API_KEY);
  }

  async search(query: string, opts: SearchQueryOptions): Promise<SearchDocument[]> {
    const url = new URL(ENDPOINT);
    url.searchParams.set('query', query);
    if (opts.language) url.searchParams.set('language', opts.language);
    if (opts.country) url.searchParams.set('location', opts.country);

    if (opts.intent === 'academic') {
      url.searchParams.set('domain_type', 'research_paper');
    } else {
      if (opts.intent === 'news') url.searchParams.set('domain_type', 'news');
      // recency_minutes and after_date/before_date are mutually exclusive;
      // maxAgeDays only ever comes from the news path, so this is safe.
      if (opts.maxAgeDays) {
        url.searchParams.set('recency_minutes', String(opts.maxAgeDays * 24 * 60));
      }
    }

    const res = await fetch(url, {
      headers: { 'X-API-Key': process.env.TINYFISH_API_KEY! },
      signal: opts.signal ?? AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!res.ok) {
      throw new Error(`tinyfish ${res.status}`);
    }

    const json = (await res.json()) as TinyFishResponse;
    const items = json.results ?? [];

    return items
      .slice(0, opts.limit)
      .flatMap((item, index) => toDocument(item, index, this.name));
  }
}

function toDocument(item: TinyFishItem, index: number, provider: string): SearchDocument[] {
  if (!item.url || !item.title) return [];
  const canonicalUrl = canonicalizeUrl(item.url);
  if (!canonicalUrl) return [];

  return [
    {
      url: item.url,
      canonicalUrl,
      title: item.title.trim(),
      snippet: (item.snippet ?? '').trim(),
      domain: domainOf(item.url),
      // TinyFish never returns a per-result date today.
      publishedAt: null,
      provider,
      rank: (item.position ?? index) + 1,
    },
  ];
}
