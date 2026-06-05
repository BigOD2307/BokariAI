/**
 * @module tests/social/cache
 * @description Unit tests for the social cache layer. Mocks the provider so we
 * can count live calls, and uses a real SemanticCache backed by a temp SQLite
 * file (DATA_DIR is already a tmpdir per tests/setup.ts).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';

const searchSpy = vi.fn(async (_q: string) => ({
  results: [{ title: 'T', url: 'https://x.com/a/1', content: 'hello' }],
  suggestions: [],
}));

vi.mock('@/lib/social/provider', () => ({
  getSocialProvider: vi.fn(() => ({
    network: 'x',
    kind: 'site',
    search: searchSpy,
  })),
}));

import { SemanticCache } from '@/lib/cache/store';
import {
  cachedSocialSearch,
  socialCacheKey,
  setSocialCacheStore,
} from '@/lib/social/cache';

let store: SemanticCache;

beforeEach(() => {
  vi.clearAllMocks();
  // Unique DB file per test so rows don't bleed across cases.
  const dbPath = path.join(
    process.env.DATA_DIR || process.cwd(),
    `social-cache-${Math.random().toString(36).slice(2)}.sqlite`,
  );
  store = new SemanticCache(dbPath);
  setSocialCacheStore(store);
});

afterEach(() => {
  store.close();
  setSocialCacheStore(null);
});

describe('social/cache', () => {
  it('namespaces the key per network', () => {
    expect(socialCacheKey('x', 'q')).not.toBe(socialCacheKey('reddit', 'q'));
    expect(socialCacheKey('x', 'q')).toBe(socialCacheKey('x', 'q'));
  });

  it('misses then hits — second call served from cache, provider hit once', async () => {
    const first = await cachedSocialSearch('x', 'engrais', { store });
    expect(first.results).toHaveLength(1);
    expect(searchSpy).toHaveBeenCalledTimes(1);

    const second = await cachedSocialSearch('x', 'engrais', { store });
    expect(second.results).toHaveLength(1);
    expect(second.results[0].url).toBe('https://x.com/a/1');
    // No second provider call — served from cache.
    expect(searchSpy).toHaveBeenCalledTimes(1);
  });

  it('different networks do not share a cache entry', async () => {
    await cachedSocialSearch('x', 'engrais', { store });
    await cachedSocialSearch('reddit', 'engrais', { store });
    expect(searchSpy).toHaveBeenCalledTimes(2);
  });

  it('expired entries fall through to a live fetch (TTL)', async () => {
    await cachedSocialSearch('x', 'engrais', { store });
    expect(searchSpy).toHaveBeenCalledTimes(1);

    // Simulate TTL expiry: drop the row (mimics expires_at <= now()).
    const key = socialCacheKey('x', 'engrais');
    const entry = store.getByHash(key);
    expect(entry).not.toBeNull();
    if (entry) store.delete(entry.id);

    await cachedSocialSearch('x', 'engrais', { store });
    expect(searchSpy).toHaveBeenCalledTimes(2);
  });
});
