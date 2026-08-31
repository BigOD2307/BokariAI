import type { SearchDocument, SearchProvider, SearchQueryOptions } from '../types';
import { canonicalizeUrl, domainOf } from '../url';
import { parsePublishedAt } from '../dates';

const ENDPOINT_NEWS = 'https://google.serper.dev/news';
const ENDPOINT_SEARCH = 'https://google.serper.dev/search';
const TIMEOUT_MS = 8_000;

type SerperItem = {
  title?: string;
  link?: string;
  snippet?: string;
  date?: string;
};

/** Serper: Google results as JSON. ~1 USD / 1000 requests, 2500 free per month
 *  (verified 2026-08-30). Chosen over Exa/Tavily/SerpAPI on price and on the
 *  `gl`/`hl` parameters, which materially change results for West Africa.
 *  The only provider in the chain that returns a real per-result date, which
 *  is why it leads for news intent despite costing money. */
export class SerperProvider implements SearchProvider {
  readonly name = 'serper';

  isConfigured(): boolean {
    return Boolean(process.env.SERPER_API_KEY);
  }

  async search(query: string, opts: SearchQueryOptions): Promise<SearchDocument[]> {
    const isNews = opts.intent === 'news';
    const body: Record<string, unknown> = {
      q: query,
      hl: opts.language,
      num: Math.min(opts.limit, 20),
    };
    if (opts.country) body.gl = opts.country.toLowerCase();
    if (isNews && opts.maxAgeDays) body.tbs = tbsForDays(opts.maxAgeDays);

    const res = await fetch(isNews ? ENDPOINT_NEWS : ENDPOINT_SEARCH, {
      method: 'POST',
      headers: {
        'X-API-KEY': process.env.SERPER_API_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: opts.signal ?? AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!res.ok) {
      throw new Error(`serper ${res.status}`);
    }

    const json = (await res.json()) as { news?: SerperItem[]; organic?: SerperItem[] };
    const items = (isNews ? json.news : json.organic) ?? [];

    return items.flatMap((item, index) => toDocument(item, index, this.name));
  }
}

function tbsForDays(days: number): string {
  if (days <= 1) return 'qdr:d';
  if (days <= 7) return 'qdr:w';
  if (days <= 31) return 'qdr:m';
  return 'qdr:y';
}

function toDocument(item: SerperItem, index: number, provider: string): SearchDocument[] {
  if (!item.link || !item.title) return [];
  const canonicalUrl = canonicalizeUrl(item.link);
  if (!canonicalUrl) return [];

  return [
    {
      url: item.link,
      canonicalUrl,
      title: item.title.trim(),
      snippet: (item.snippet ?? '').trim(),
      domain: domainOf(item.link),
      publishedAt: parsePublishedAt(item.date),
      provider,
      rank: index + 1,
    },
  ];
}
