/**
 * @module cache/semantic.test
 * @description Unit tests for the semantic cache helpers.
 * @author Amadou — Dicken AI
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { SemanticCache } from '@/lib/cache/store';
import {
  normaliseQuery,
  hashQuery,
  hashHistory,
  scopeKey,
  isCacheable,
  tryGetCachedResponse,
  cacheResponse,
  getCacheStats,
  setSemanticCacheStore,
  COSINE_THRESHOLD,
  type CacheScope,
} from '@/lib/cache/semantic';

let tmp: string;
let cache: SemanticCache;

const scope = (over: Partial<CacheScope> = {}): CacheScope => ({
  mode: 'speed',
  historyHash: hashHistory([]),
  fileIds: [],
  sources: ['web'],
  ...over,
});

beforeEach(() => {
  tmp = mkdtempSync(path.join(tmpdir(), 'bokari-sem-'));
  cache = new SemanticCache(path.join(tmp, 'cache.sqlite'));
  setSemanticCacheStore(cache);
});

afterEach(() => {
  cache.close();
  setSemanticCacheStore(null);
  rmSync(tmp, { recursive: true, force: true });
});

describe('normaliseQuery', () => {
  it('lowercases and strips punctuation', () => {
    expect(normaliseQuery('Hello, World!')).toBe('hello world');
  });

  it('drops English stop words (incl. interrogatives like "what")', () => {
    // The multilingual cache treats interrogatives as fillers so
    // "what is the capital of France" collides with "capital of France".
    expect(normaliseQuery('What is the capital of France?'))
      .toBe('capital france');
  });

  it('preserves numbers', () => {
    // "who" is dropped as a filler; the salient number/terms survive.
    expect(normaliseQuery('Who won the 2022 World Cup?'))
      .toBe('2022 cup won world');
  });

  it('is order-insensitive for word re-orderings', () => {
    expect(normaliseQuery('capital of France'))
      .toBe(normaliseQuery('France capital'));
  });

  it('returns empty string for stop-word-only input', () => {
    expect(normaliseQuery('a an the of in')).toBe('');
  });

  it('collapses whitespace', () => {
    expect(normaliseQuery('  foo   bar  \n  baz  ')).toBe('bar baz foo');
  });
});

describe('hashQuery', () => {
  it('is deterministic', () => {
    const a = hashQuery('What is the capital of France?');
    const b = hashQuery('What is the capital of France?');
    expect(a).toBe(b);
  });

  it('produces the same hash for semantically equivalent inputs', () => {
    const a = hashQuery('capital of France');
    const b = hashQuery('France capital');
    expect(a).toBe(b);
  });

  it('produces different hashes for distinct intents', () => {
    const a = hashQuery('capital of France');
    const b = hashQuery('capital of Germany');
    expect(a).not.toBe(b);
  });
});

describe('scopeKey / isCacheable / hashHistory', () => {
  it('is deterministic for the same scope', () => {
    expect(scopeKey(scope())).toBe(scopeKey(scope()));
  });

  it('differs when mode differs', () => {
    expect(scopeKey(scope({ mode: 'speed' }))).not.toBe(scopeKey(scope({ mode: 'quality' })));
  });

  it('differs when history differs', () => {
    const a = scope({ historyHash: hashHistory([['human', 'bonjour']]) });
    const b = scope({ historyHash: hashHistory([['human', 'salut']]) });
    expect(scopeKey(a)).not.toBe(scopeKey(b));
  });

  it('is insensitive to the order of enabled sources', () => {
    expect(scopeKey(scope({ sources: ['web', 'academic'] }))).toBe(
      scopeKey(scope({ sources: ['academic', 'web'] })),
    );
  });

  it('marks a file-grounded scope as not cacheable', () => {
    expect(isCacheable(scope({ fileIds: [] }))).toBe(true);
    expect(isCacheable(scope({ fileIds: ['file-1'] }))).toBe(false);
  });

  it('hashHistory is deterministic and order-sensitive', () => {
    const a: [string, string][] = [['human', 'bonjour'], ['ai', 'salut']];
    const b: [string, string][] = [['ai', 'salut'], ['human', 'bonjour']];
    expect(hashHistory(a)).toBe(hashHistory(a));
    expect(hashHistory(a)).not.toBe(hashHistory(b));
  });
});

describe('tryGetCachedResponse', () => {
  it('misses on an empty cache', async () => {
    const embed = async () => [0.1, 0.2, 0.3];
    const got = await tryGetCachedResponse('What is the capital of France?', embed, scope(), { store: cache });
    expect(got).toBeNull();
  });

  it('hits on the exact normalised query', async () => {
    await cacheResponse('What is the capital of France?', [0.1, 0.2, 0.3], 'Paris', scope(), { store: cache });
    const embed = async () => [0.1, 0.2, 0.3];
    const got = await tryGetCachedResponse('What is the capital of France?', embed, scope(), { store: cache });
    expect(got).not.toBeNull();
    expect(got!.response).toBe('Paris');
    expect(got!.hitType).toBe('exact');
    expect(got!.similarity).toBe(1);
  });

  it('hits via cosine similarity on a near-identical query', async () => {
    const v = Array.from({ length: 16 }, (_, i) => Math.sin(i * 0.1));
    await cacheResponse('capital of France', v, 'Paris', scope(), { store: cache });
    const v2 = v.map((x) => x + 0.0001);
    const embed = async () => v2;
    const got = await tryGetCachedResponse('France capital please', embed, scope(), { store: cache });
    expect(got).not.toBeNull();
    expect(got!.response).toBe('Paris');
    expect(got!.hitType).toBe('semantic');
    expect(got!.similarity).toBeGreaterThan(COSINE_THRESHOLD - 0.05);
  });

  it('misses when the best similarity is below the threshold', async () => {
    const v1 = Array.from({ length: 16 }, (_, i) => Math.sin(i * 0.1 + 1));
    const v2 = Array.from({ length: 16 }, (_, i) => Math.sin(i * 0.1 + 999));
    await cacheResponse('capital of France', v1, 'Paris', scope(), { store: cache });
    const embed = async () => v2;
    const got = await tryGetCachedResponse('something totally different', embed, scope(), { store: cache });
    expect(got).toBeNull();
  });

  it('never reads or writes for a file-grounded scope (BUG-25)', async () => {
    const fileScope = scope({ fileIds: ['file-1'] });
    const id = await cacheResponse('resume ce document', [0.1, 0.2, 0.3], 'Le document dit...', fileScope, {
      store: cache,
    });
    expect(id).toBeNull();
    const embed = async () => [0.1, 0.2, 0.3];
    const got = await tryGetCachedResponse('resume ce document', embed, fileScope, { store: cache });
    expect(got).toBeNull();
    expect(getCacheStats({ store: cache }).size).toBe(0);
  });

  it('does not serve a hit written under a different mode (BUG-25)', async () => {
    await cacheResponse('et au senegal', [0.1, 0.2, 0.3], 'Reponse conversation A', scope({ mode: 'speed' }), {
      store: cache,
    });
    const embed = async () => [0.1, 0.2, 0.3];
    const got = await tryGetCachedResponse('et au senegal', embed, scope({ mode: 'quality' }), { store: cache });
    expect(got).toBeNull();
  });

  it('does not serve a hit written under a different conversation history (BUG-25)', async () => {
    const scopeA = scope({ historyHash: hashHistory([['human', 'parlons du mali']]) });
    const scopeB = scope({ historyHash: hashHistory([['human', 'parlons du senegal']]) });
    await cacheResponse('et le budget', [0.1, 0.2, 0.3], 'Reponse pour le Mali', scopeA, { store: cache });
    const embed = async () => [0.1, 0.2, 0.3];
    const got = await tryGetCachedResponse('et le budget', embed, scopeB, { store: cache });
    expect(got).toBeNull();
  });

  it('returns the sources stored alongside the response, exact-hash path', async () => {
    const sources = [{ metadata: { url: 'https://lefaso.net/a', title: 'Titre' } }];
    await cacheResponse('capital du mali', [0.1, 0.2, 0.3], 'Bamako', scope(), { store: cache, sources });
    const embed = async () => [0.1, 0.2, 0.3];
    const got = await tryGetCachedResponse('capital du mali', embed, scope(), { store: cache });
    expect(got!.sources).toEqual(sources);
  });

  it('returns the sources stored alongside the response, semantic path', async () => {
    const v = Array.from({ length: 16 }, (_, i) => Math.sin(i * 0.1));
    const sources = [{ metadata: { url: 'https://lefaso.net/a', title: 'Titre' } }];
    await cacheResponse('capital du mali', v, 'Bamako', scope(), { store: cache, sources });
    const v2 = v.map((x) => x + 0.0001);
    const embed = async () => v2;
    const got = await tryGetCachedResponse('capitale mali svp', embed, scope(), { store: cache });
    expect(got!.sources).toEqual(sources);
  });
});

describe('cacheResponse', () => {
  it('persists the response and bumps the cache size', async () => {
    const id = await cacheResponse('hello', [0.1, 0.2, 0.3], 'world', scope(), { store: cache });
    expect(id).toBeGreaterThan(0);
    const stats = getCacheStats({ store: cache });
    expect(stats.size).toBe(1);
  });
});
