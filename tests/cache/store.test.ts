/**
 * @module cache/store.test
 * @description Unit tests for the SQLite-backed semantic cache.
 * @author Amadou — Dicken AI
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { SemanticCache, packEmbedding, cosineSimilarity } from '@/lib/cache/store';

let tmp: string;
let cache: SemanticCache;

beforeEach(() => {
  tmp = mkdtempSync(path.join(tmpdir(), 'bokari-cache-'));
  cache = new SemanticCache(path.join(tmp, 'cache.sqlite'));
});

afterEach(() => {
  cache.close();
  rmSync(tmp, { recursive: true, force: true });
});

const dummyVec = (n: number, seed: number = 1): number[] =>
  Array.from({ length: n }, (_, i) => Math.sin(i * 0.1 + seed));

describe('SemanticCache', () => {
  it('upserts and retrieves by exact hash', () => {
    const id = cache.upsert({
      query: 'capital of France',
      queryHash: 'abc',
      embedding: dummyVec(16),
      response: 'Paris',
      metadata: { source: 'test' },
      ttlMs: 60_000,
    });
    expect(id).toBeGreaterThan(0);
    const got = cache.getByHash('abc');
    expect(got).not.toBeNull();
    expect(got!.response).toBe('Paris');
    expect(got!.metadata.source).toBe('test');
  });

  it('refuses to return expired entries', async () => {
    cache.upsert({
      query: 'q',
      queryHash: 'short',
      embedding: dummyVec(8),
      response: 'r',
      metadata: {},
      ttlMs: 10,
    });
    await new Promise((r) => setTimeout(r, 20));
    const got = cache.getByHash('short');
    expect(got).toBeNull();
  });

  it('scanSimilar returns the best match above the threshold', () => {
    const v = dummyVec(32, 1);
    cache.upsert({
      query: 'q1',
      queryHash: 'h1',
      embedding: v,
      response: 'one',
      metadata: {},
      ttlMs: 60_000,
    });
    // Tiny perturbation of v — should still be very similar.
    const v2 = v.map((x) => x + 0.001);
    const matches = cache.scanSimilar(v2, 0.9, 5);
    expect(matches.length).toBe(1);
    expect(matches[0]!.entry.response).toBe('one');
    expect(matches[0]!.similarity).toBeGreaterThan(0.9);
  });

  it('scanSimilar filters out low-similarity rows', () => {
    cache.upsert({
      query: 'q1',
      queryHash: 'h1',
      embedding: dummyVec(16, 1),
      response: 'one',
      metadata: {},
      ttlMs: 60_000,
    });
    cache.upsert({
      query: 'q2',
      queryHash: 'h2',
      embedding: dummyVec(16, 100),
      response: 'two',
      metadata: {},
      ttlMs: 60_000,
    });
    // Query with the seed=1 vector — should match q1, not q2.
    const matches = cache.scanSimilar(dummyVec(16, 1), 0.9, 5);
    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(matches[0]!.entry.response).toBe('one');
  });

  it('recordHit bumps the hit counter', () => {
    const id = cache.upsert({
      query: 'q',
      queryHash: 'h',
      embedding: dummyVec(8),
      response: 'r',
      metadata: {},
      ttlMs: 60_000,
    });
    cache.recordHit(id);
    cache.recordHit(id);
    const got = cache.getByHash('h');
    expect(got!.hitCount).toBe(2);
  });

  it('prune removes expired rows and reports the count', async () => {
    cache.upsert({
      query: 'q',
      queryHash: 'h',
      embedding: dummyVec(8),
      response: 'r',
      metadata: {},
      ttlMs: 10,
    });
    await new Promise((r) => setTimeout(r, 20));
    const removed = cache.prune();
    expect(removed).toBe(1);
    expect(cache.stats().size).toBe(0);
  });

  it('clear empties the table', () => {
    cache.upsert({
      query: 'q',
      queryHash: 'h',
      embedding: dummyVec(8),
      response: 'r',
      metadata: {},
      ttlMs: 60_000,
    });
    cache.clear();
    expect(cache.stats().size).toBe(0);
  });

  it('stats returns size and total hits', () => {
    expect(cache.stats()).toEqual({ size: 0, hits: 0 });
    const id = cache.upsert({
      query: 'q',
      queryHash: 'h',
      embedding: dummyVec(8),
      response: 'r',
      metadata: {},
      ttlMs: 60_000,
    });
    cache.recordHit(id);
    const s = cache.stats();
    expect(s.size).toBe(1);
    expect(s.hits).toBe(1);
  });
});

describe('packEmbedding / unpackEmbedding', () => {
  it('round-trips a vector', () => {
    const v = [0.1, 0.2, -0.3, 1.5];
    const buf = packEmbedding(v);
    const back = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
    const got = Array.from(back);
    // Float32 is lossy — assert element-wise with a generous tolerance.
    expect(got.length).toBe(v.length);
    for (let i = 0; i < v.length; i++) {
      expect(got[i]).toBeCloseTo(v[i]!, 5);
    }
  });
});

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    const a = new Float32Array([1, 0, 0]);
    const b = new Float32Array([1, 0, 0]);
    expect(cosineSimilarity(a, b)).toBeCloseTo(1, 5);
  });

  it('returns 0 for orthogonal vectors', () => {
    const a = new Float32Array([1, 0]);
    const b = new Float32Array([0, 1]);
    expect(cosineSimilarity(a, b)).toBeCloseTo(0, 5);
  });

  it('returns 0 for the zero vector', () => {
    const a = new Float32Array(3);
    const b = new Float32Array([1, 2, 3]);
    expect(cosineSimilarity(a, b)).toBe(0);
  });

  it('returns 0 for mismatched lengths', () => {
    const a = new Float32Array([1, 2, 3]);
    const b = new Float32Array([1, 2]);
    expect(cosineSimilarity(a, b)).toBe(0);
  });
});
