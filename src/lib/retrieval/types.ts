/**
 * One search hit, normalised across providers.
 *
 * `publishedAt` is the field the old `SearchResult` (src/lib/search.ts) never
 * had. Everything downstream — freshness ranking, dated citations, the "is
 * this still true?" question a journalist asks — depends on it existing here.
 */
export type SearchDocument = {
  url: string;
  /** Normalised for dedup: lowercase host, no www, no tracking params, no trailing slash. */
  canonicalUrl: string;
  title: string;
  snippet: string;
  domain: string;
  publishedAt: Date | null;
  /** Which provider produced it, for observability and for RRF grouping. */
  provider: string;
  /** 1-based rank within that provider's result list. */
  rank: number;
};

export type SearchIntent = 'news' | 'general' | 'academic';

export type SearchQueryOptions = {
  intent: SearchIntent;
  /** ISO 639-1, e.g. 'fr'. */
  language: string;
  /** ISO 3166-1 alpha-2, e.g. 'ML'. Biases the engine towards local sources. */
  country?: string;
  /** Only return documents published within this many days. News intent only. */
  maxAgeDays?: number;
  limit: number;
  signal?: AbortSignal;
};

export interface SearchProvider {
  readonly name: string;
  /** False when the provider lacks credentials or is disabled — skipped silently. */
  isConfigured(): boolean;
  search(query: string, opts: SearchQueryOptions): Promise<SearchDocument[]>;
}
