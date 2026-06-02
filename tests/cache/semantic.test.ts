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
  tryGetCachedResponse,
  cacheResponse,
  getCacheStats,
  setSemanticCacheStore,
  COSINE_THRESHOLD,
} from '@/lib/cache/semantic';

let tmp: string;
let cache: SemanticCache;

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

  it('drops English stop words', () => {
    expect(normaliseQuery('What is the capital of France?'))
      .toBe('capital france what');
  });

  it('preserves numbers', () => {
    expect(normaliseQuery('Who won the 2022 World Cup?'))
      .toBe('2022 cup who won world');
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

describe('tryGetCachedResponse', () => {
  it('misses on an empty cache', async () => {
    const embed = async () => [0.1, 0.2, 0.3];
    const got = await tryGetCachedResponse('What is the capital of France?', embed, { store: cache });
    expect(got).toBeNull();
  });

  it('hits on the exact normalised query', async () => {
    await cacheResponse('What is the capital of France?', [0.1, 0.2, 0.3], 'Paris', { store: cache });
    const embed = async () => [0.1, 0.2, 0.3];
    const got = await tryGetCachedResponse('What is the capital of France?', embed, { store: cache });
    expect(got).not.toBeNull();
    expect(got!.response).toBe('Paris');
    expect(got!.hitType).toBe('exact');
    expect(got!.similarity).toBe(1);
  });

  it('hits via cosine similarity on a near-identical query', async () => {
    const v = Array.from({ length: 16 }, (_, i) => Math.sin(i * 0.1));
    await cacheResponse('capital of France', v, 'Paris', { store: cache });
    const v2 = v.map((x) => x + 0.0001);
    const embed = async () => v2;
    const got = await tryGetCachedResponse('France capital please', embed, { store: cache });
    expect(got).not.toBeNull();
    expect(got!.response).toBe('Paris');
    expect(got!.hitType).toBe('semantic');
    expect(got!.similarity).toBeGreaterThan(COSINE_THRESHOLD - 0.05);
  });

  it('misses when the best similarity is below the threshold', async () => {
    const v1 = Array.from({ length: 16 }, (_, i) => Math.sin(i * 0.1 + 1));
    const v2 = Array.from({ length: 16 }, (_, i) => Math.sin(i * 0.1 + 999));
    await cacheResponse('capital of France', v1, 'Paris', { store: cache });
    const embed = async () => v2;
    const got = await tryGetCachedResponse('something totally different', embed, { store: cache });
    expect(got).toBeNull();
  });
});

describe('cacheResponse', () => {
  it('persists the response and bumps the cache size', async () => {
    const id = await cacheResponse('hello', [0.1, 0.2, 0.3], 'world', { store: cache });
    expect(id).toBeGreaterThan(0);
    const stats = getCacheStats({ store: cache });
    expect(stats.size).toBe(1);
  });
});
