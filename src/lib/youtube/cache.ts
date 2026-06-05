/**
 * @module youtube/cache
 * @description Thin caching layer over `getYouTubeProvider().search`, reusing
 * the SQLite-backed `SemanticCache` with a `youtube:` namespaced query hash and
 * a volatile TTL — mirrors `src/lib/social/cache.ts`.
 *
 * Exact-hash only (no cosine): YouTube result sets are small and cheap to
 * refetch; we want a fast dedup of *identical* queries within a TTL window, not
 * fuzzy recall. The stored embedding is an unused placeholder. NEVER throws —
 * on any store error we fall through to a live provider call.
 */
import { SemanticCache } from '@/lib/cache/store';
import { hashQuery, FRESH_TTL_MS } from '@/lib/cache/semantic';
import { getYouTubeProvider } from './provider';
import type { YouTubeSearchOptions, YouTubeSearchResult } from './types';

/** TTL for cached YouTube results. Tunable via env; defaults to FRESH_TTL_MS. */
export const YOUTUBE_CACHE_TTL_MS = (() => {
  const raw = Number(process.env.BOKARI_YOUTUBE_CACHE_TTL_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : FRESH_TTL_MS;
})();

/** Placeholder vector — exact-hash lookups don't use it; keep it tiny. */
const PLACEHOLDER_EMBEDDING = [0];

/** Namespaced cache key for a YouTube search query. */
export const youtubeCacheKey = (query: string): string =>
  hashQuery(`youtube:${query}`);

let _store: SemanticCache | null = null;
const defaultStore = (): SemanticCache => {
  if (!_store) _store = new SemanticCache();
  return _store;
};

/** Test-only: inject (or reset with null) the backing store. */
export const setYouTubeCacheStore = (store: SemanticCache | null): void => {
  _store = store;
};

/**
 * Cached YouTube search. Exact-hash hit within the TTL → cached payload;
 * otherwise call the provider, cache the JSON, and return it. Never throws.
 */
export const cachedYouTubeSearch = async (
  query: string,
  opts?: YouTubeSearchOptions & { store?: SemanticCache },
): Promise<YouTubeSearchResult> => {
  const store = opts?.store ?? defaultStore();
  const key = youtubeCacheKey(query);

  try {
    const hit = store.getByHash(key);
    if (hit) {
      store.recordHit(hit.id);
      const parsed = JSON.parse(hit.response) as YouTubeSearchResult;
      if (parsed && Array.isArray(parsed.results)) return parsed;
    }
  } catch {
    /* corrupt/expired entry — fall through to a live fetch */
  }

  const result = await getYouTubeProvider().search(query, opts);

  try {
    store.upsert({
      query: `youtube:${query}`,
      queryHash: key,
      embedding: PLACEHOLDER_EMBEDDING,
      response: JSON.stringify(result),
      metadata: { kind: 'youtube' },
      ttlMs: YOUTUBE_CACHE_TTL_MS,
    });
  } catch {
    /* caching is best-effort; the result is already in hand */
  }

  return result;
};
