/**
 * @module social/cache
 * @description Thin caching layer over `getSocialProvider().search`, reusing
 * the SQLite-backed `SemanticCache` (store.ts) with a `social:<net>:`
 * namespaced query hash and a volatile TTL.
 *
 * Why exact-hash only (no cosine scan): social results are small, network-
 * scoped, and cheap to refetch; we want a fast dedup of *identical* queries
 * within a TTL window, not fuzzy semantic recall (which could leak an X result
 * to a LinkedIn query). The `social:<net>:` prefix folded into `hashQuery`
 * guarantees per-network isolation. The stored embedding is an unused
 * placeholder (the cosine path is never exercised here).
 *
 * Volatile TTL: social chatter goes stale fast, so we use the short
 * `FRESH_TTL_MS`. The cache NEVER throws — on any store error we fall through
 * to a live provider call.
 */
import { SemanticCache } from '@/lib/cache/store';
import { hashQuery, FRESH_TTL_MS } from '@/lib/cache/semantic';
import { getSocialProvider } from './provider';
import type {
  SocialNetwork,
  SocialSearchOptions,
  SocialSearchResult,
} from './types';

/** TTL for cached social results. Tunable via env; defaults to FRESH_TTL_MS. */
export const SOCIAL_CACHE_TTL_MS = (() => {
  const raw = Number(process.env.BOKARI_SOCIAL_CACHE_TTL_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : FRESH_TTL_MS;
})();

/** Placeholder vector — exact-hash lookups don't use it; keep it tiny. */
const PLACEHOLDER_EMBEDDING = [0];

/** Namespaced, network-isolated cache key for a social query. */
export const socialCacheKey = (network: SocialNetwork, query: string): string =>
  hashQuery(`social:${network}:${query}`);

let _store: SemanticCache | null = null;
const defaultStore = (): SemanticCache => {
  if (!_store) _store = new SemanticCache();
  return _store;
};

/** Test-only: inject (or reset with null) the backing store. */
export const setSocialCacheStore = (store: SemanticCache | null): void => {
  _store = store;
};

/**
 * Cached social search. Exact-hash hit within the TTL → cached payload;
 * otherwise call the provider, cache the JSON, and return it. Never throws.
 */
export const cachedSocialSearch = async (
  network: SocialNetwork,
  query: string,
  opts?: SocialSearchOptions & { store?: SemanticCache },
): Promise<SocialSearchResult> => {
  const store = opts?.store ?? defaultStore();
  const key = socialCacheKey(network, query);

  try {
    const hit = store.getByHash(key);
    if (hit) {
      store.recordHit(hit.id);
      const parsed = JSON.parse(hit.response) as SocialSearchResult;
      if (parsed && Array.isArray(parsed.results)) return parsed;
    }
  } catch {
    /* corrupt/expired entry — fall through to a live fetch */
  }

  const result = await getSocialProvider(network).search(query, opts);

  try {
    store.upsert({
      query: `social:${network}:${query}`,
      queryHash: key,
      embedding: PLACEHOLDER_EMBEDDING,
      response: JSON.stringify(result),
      metadata: { network, kind: 'social' },
      ttlMs: SOCIAL_CACHE_TTL_MS,
    });
  } catch {
    /* caching is best-effort; the result is already in hand */
  }

  return result;
};
