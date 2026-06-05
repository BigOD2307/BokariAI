/**
 * @module youtube/provider
 * @description Env-selected YouTube SEARCH provider router, mirroring the
 * social provider router (`src/lib/social/provider.ts`) — cached at module
 * scope, resettable for tests, with a safe zero-config default.
 *
 * Selection (resolved per call so env changes after a reset take effect):
 *   - "api"        when `YOUTUBE_API_KEY` is set → YouTube Data API v3
 *                  search.list (quota-aware; on 403/quota it falls back to
 *                  the scrape path).
 *   - "brightdata" when `YOUTUBE_SEARCH_PROVIDER=brightdata` AND a Bright Data
 *                  key + YouTube dataset id are present (the implementation
 *                  brief recommends Bright Data for YouTube). Discover-by-
 *                  keyword via the Web Scraper API; falls back to scrape on any
 *                  failure.
 *   - "scrape"     DEFAULT, zero-config. Delegates to the EXISTING
 *                  `searchYouTube()` in `@/lib/search` (site:youtube.com via
 *                  DuckDuckGo). Always available, no keys.
 *
 * Master switch `BOKARI_YOUTUBE_SEARCH_ENABLED` (default true) lets ops force
 * the cheap path; when false everything resolves to `scrape` so search keeps
 * working. Every provider is NON-THROWING and gracefully falls back to scrape.
 */
import type { SearchResult } from '@/lib/search';
import type {
  YouTubeProvider,
  YouTubeProviderKind,
  YouTubeSearchOptions,
  YouTubeSearchResult,
} from './types';
import { extractVideoId } from './id';

const API_BASE = 'https://www.googleapis.com/youtube/v3';
const BRIGHTDATA_BASE = 'https://api.brightdata.com';

const apiKey = (): string | null =>
  process.env.YOUTUBE_API_KEY?.trim() || null;
const brightDataKey = (): string | null =>
  process.env.BRIGHTDATA_API_KEY?.trim() || null;
const brightDataDataset = (): string | null =>
  process.env.BRIGHTDATA_DS_YOUTUBE_VIDEOS?.trim() || null;

/** Whether YouTube search is enabled at all. Default true → zero-config on. */
export const isYouTubeSearchEnabled = (): boolean =>
  (process.env.BOKARI_YOUTUBE_SEARCH_ENABLED ?? 'true').toLowerCase() !==
  'false';

/** Map a raw YouTube video id to the enriched `SearchResult` the UI expects. */
const videoResult = (
  videoId: string,
  title: string,
  content?: string,
): SearchResult => ({
  title,
  url: `https://www.youtube.com/watch?v=${videoId}`,
  content,
  thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
  img_src: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
  iframe_src: `https://www.youtube.com/embed/${videoId}`,
});

/** Shared scrape fallback — the existing zero-config YouTube path. */
const scrapeSearch = async (
  query: string,
  opts?: YouTubeSearchOptions,
): Promise<YouTubeSearchResult> => {
  // Dynamic import breaks the module cycle (search.ts routes the youtube
  // engine through this provider).
  const { searchSearxng } = await import('@/lib/search');
  const res = await searchSearxng(query, { engines: ['youtube_scrape'] });
  const results = opts?.maxResults
    ? res.results.slice(0, opts.maxResults)
    : res.results;
  return { results, suggestions: res.suggestions ?? [] };
};

/** DEFAULT provider: delegate to the existing DDG site:youtube.com scraper. */
const createScrapeProvider = (): YouTubeProvider => ({
  kind: 'scrape',
  async search(query, opts) {
    try {
      return await scrapeSearch(query, opts);
    } catch (err) {
      console.warn('[Bokari YouTube] scrape provider failed:', err);
      return { results: [], suggestions: [] };
    }
  },
});

/** YouTube Data API v3 search.list. Quota-aware: 403/quotaExceeded → scrape. */
const createApiProvider = (): YouTubeProvider => ({
  kind: 'api',
  async search(query, opts) {
    const key = apiKey();
    if (!key) return scrapeSearch(query, opts);
    const limit = Math.max(1, Math.min(opts?.maxResults ?? 10, 25));
    try {
      const params = new URLSearchParams({
        key,
        part: 'snippet',
        type: 'video',
        q: query,
        maxResults: String(limit),
        relevanceLanguage: (opts?.language ?? 'fr').slice(0, 2),
      });
      const res = await fetch(`${API_BASE}/search?${params}`, {
        signal: AbortSignal.timeout(8000),
      });
      // Quota exhausted / forbidden / any non-OK → graceful scrape fallback.
      if (!res.ok) return scrapeSearch(query, opts);
      const json = (await res.json()) as {
        items?: Array<{
          id?: { videoId?: string };
          snippet?: { title?: string; description?: string };
        }>;
      };
      const results: SearchResult[] = (json.items ?? [])
        .map((it) => {
          const id = it.id?.videoId;
          if (!id) return null;
          return videoResult(
            id,
            it.snippet?.title ?? id,
            it.snippet?.description,
          );
        })
        .filter((r): r is SearchResult => r !== null)
        .slice(0, limit);
      // Empty result set → the scrape path is better than nothing.
      if (results.length === 0) return scrapeSearch(query, opts);
      return { results, suggestions: [] };
    } catch (err) {
      console.warn('[Bokari YouTube] API provider failed, scraping:', err);
      return scrapeSearch(query, opts);
    }
  },
});

/** Bright Data Web Scraper API — discover-by-keyword on the video dataset. */
const createBrightDataProvider = (): YouTubeProvider => ({
  kind: 'brightdata',
  async search(query, opts) {
    const key = brightDataKey();
    const dataset = brightDataDataset();
    if (!key || !dataset) return scrapeSearch(query, opts);
    const limit = Math.max(1, Math.min(opts?.maxResults ?? 10, 25));
    const headers = {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    };
    const pollIntervalMs = Number(process.env.BRIGHTDATA_POLL_INTERVAL_MS) || 4000;
    const pollTimeoutMs = Number(process.env.BRIGHTDATA_POLL_TIMEOUT_MS) || 45000;
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    try {
      const params = new URLSearchParams({
        dataset_id: dataset,
        type: 'discover_new',
        discover_by: 'keyword',
        limit_per_input: String(limit),
        format: 'json',
        include_errors: 'true',
      });
      const trig = await fetch(`${BRIGHTDATA_BASE}/datasets/v3/trigger?${params}`, {
        method: 'POST',
        headers,
        body: JSON.stringify([{ keyword: query, num_of_posts: limit }]),
        signal: AbortSignal.timeout(15000),
      });
      if (!trig.ok) return scrapeSearch(query, opts);
      const { snapshot_id: snapshotId } = (await trig.json()) as {
        snapshot_id?: string;
      };
      if (!snapshotId) return scrapeSearch(query, opts);

      const deadline = Date.now() + pollTimeoutMs;
      let ready = false;
      while (Date.now() < deadline) {
        const prog = await fetch(
          `${BRIGHTDATA_BASE}/datasets/v3/progress/${snapshotId}`,
          { headers, signal: AbortSignal.timeout(15000) },
        );
        if (prog.ok) {
          const { status } = (await prog.json()) as { status?: string };
          if (status === 'ready') {
            ready = true;
            break;
          }
          if (status === 'failed') return scrapeSearch(query, opts);
        }
        await sleep(pollIntervalMs);
      }
      if (!ready) return scrapeSearch(query, opts);

      const snap = await fetch(
        `${BRIGHTDATA_BASE}/datasets/v3/snapshot/${snapshotId}?format=json`,
        { headers, signal: AbortSignal.timeout(20000) },
      );
      if (snap.status !== 200) return scrapeSearch(query, opts);
      const json = await snap.json();
      const records: Record<string, unknown>[] = Array.isArray(json) ? json : [];
      const results: SearchResult[] = records
        .map((rec) => {
          const url =
            (typeof rec.url === 'string' && rec.url) ||
            (typeof rec.video_url === 'string' && rec.video_url) ||
            '';
          const id = url ? extractVideoId(url) : null;
          if (!id) return null;
          const title =
            (typeof rec.title === 'string' && rec.title) ||
            (typeof rec.name === 'string' && rec.name) ||
            id;
          const desc =
            (typeof rec.description === 'string' && rec.description) || undefined;
          return videoResult(id, title, desc);
        })
        .filter((r): r is SearchResult => r !== null)
        .slice(0, limit);
      if (results.length === 0) return scrapeSearch(query, opts);
      return { results, suggestions: [] };
    } catch (err) {
      console.warn('[Bokari YouTube] Bright Data provider failed, scraping:', err);
      return scrapeSearch(query, opts);
    }
  },
});

/** Resolve the configured provider kind (pre-fallback). */
const resolveKind = (): YouTubeProviderKind => {
  if (!isYouTubeSearchEnabled()) return 'scrape';
  const explicit = (process.env.YOUTUBE_SEARCH_PROVIDER ?? '').toLowerCase();
  if (explicit === 'brightdata' && brightDataKey() && brightDataDataset()) {
    return 'brightdata';
  }
  if (explicit === 'scrape') return 'scrape';
  // Implicit: an API key alone selects the API provider (quota-aware).
  if (apiKey()) return 'api';
  return 'scrape';
};

let cached: YouTubeProvider | null = null;

const build = (): YouTubeProvider => {
  switch (resolveKind()) {
    case 'api':
      return createApiProvider();
    case 'brightdata':
      return createBrightDataProvider();
    default:
      return createScrapeProvider();
  }
};

/** Get (memoized) the configured YouTube search provider. */
export const getYouTubeProvider = (): YouTubeProvider => {
  if (cached) return cached;
  cached = build();
  return cached;
};

/** Test/ops hook: drop the memo so env changes take effect. */
export const resetYouTubeProviderCache = (): void => {
  cached = null;
};
