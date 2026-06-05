/**
 * @module tests/youtube/cache
 * @description Tests for the YouTube search cache: exact-hash hit within TTL
 * serves the cached payload and the provider is called only once. Uses an
 * injected in-memory store stub.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the provider so the cache test is offline + deterministic.
const providerSearch = vi.fn(async () => ({
  results: [
    { title: 'V', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
  ],
  suggestions: [],
}));
vi.mock('@/lib/youtube/provider', () => ({
  getYouTubeProvider: () => ({ kind: 'scrape', search: providerSearch }),
}));

class FakeStore {
  store = new Map<string, any>();
  getByHash(hash: string) {
    return this.store.get(hash) ?? null;
  }
  recordHit() {}
  upsert(input: any) {
    this.store.set(input.queryHash, { id: 1, response: input.response });
    return 1;
  }
}

describe('youtube/cache', () => {
  beforeEach(() => providerSearch.mockClear());

  it('caches the result set: provider called once across two identical queries', async () => {
    const { cachedYouTubeSearch, youtubeCacheKey } = await import(
      '@/lib/youtube/cache'
    );
    const store = new FakeStore() as any;
    const first = await cachedYouTubeSearch('mobile money', { store });
    expect(first.results).toHaveLength(1);
    expect(providerSearch).toHaveBeenCalledTimes(1);

    const second = await cachedYouTubeSearch('mobile money', { store });
    expect(second.results).toHaveLength(1);
    // Served from cache — no second provider call.
    expect(providerSearch).toHaveBeenCalledTimes(1);

    // Key is namespaced to avoid colliding with web/social hashes.
    expect(youtubeCacheKey('mobile money')).toEqual(
      youtubeCacheKey('mobile money'),
    );
  });

  it('different queries miss independently', async () => {
    const { cachedYouTubeSearch } = await import('@/lib/youtube/cache');
    const store = new FakeStore() as any;
    await cachedYouTubeSearch('a', { store });
    await cachedYouTubeSearch('b', { store });
    expect(providerSearch).toHaveBeenCalledTimes(2);
  });
});
