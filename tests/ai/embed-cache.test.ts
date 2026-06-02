/**
 * @module ai/embed-cache.test
 * @description Tests for the in-memory LRU cache used by embedOne.
 *
 * The cache is a pure function — no gateway, no provider, no
 * network.  We test the module directly to keep the surface
 * narrow and the test fast.
 *
 * @author Amadou — Dicken AI
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  clearEmbedCache,
  embedCacheGet,
  embedCacheKey,
  embedCacheSet,
  embedCacheSize,
} from '@/lib/ai/embedCache';

beforeEach(() => {
  clearEmbedCache();
});

describe('embedCacheKey', () => {
  it('is deterministic for the same (text, model)', () => {
    expect(embedCacheKey('hello', 'bge-m3')).toBe(
      embedCacheKey('hello', 'bge-m3'),
    );
  });

  it('differs when text differs', () => {
    expect(embedCacheKey('hello', 'bge-m3')).not.toBe(
      embedCacheKey('world', 'bge-m3'),
    );
  });

  it('differs when model differs (poison-proof)', () => {
    expect(embedCacheKey('hello', 'bge-m3')).not.toBe(
      embedCacheKey('hello', 'bge-large'),
    );
  });

  it('returns a hex string', () => {
    expect(embedCacheKey('a', 'b')).toMatch(/^[0-9a-f]{1,16}$/);
  });
});

describe('embedCacheGet / Set', () => {
  it('returns undefined for an unknown key', () => {
    expect(embedCacheGet('nope')).toBeUndefined();
  });

  it('round-trips a value', () => {
    embedCacheSet('k', [0.1, 0.2, 0.3]);
    expect(embedCacheGet('k')).toEqual([0.1, 0.2, 0.3]);
  });

  it('overwrites on duplicate set', () => {
    embedCacheSet('k', [0.1]);
    embedCacheSet('k', [0.9]);
    expect(embedCacheGet('k')).toEqual([0.9]);
  });

  it('moves accessed entry to the end of the LRU (at capacity)', () => {
    // Fill to capacity.
    for (let i = 0; i < 1000; i++) {
      embedCacheSet(`k-${i}`, [i]);
    }
    // Touch 'k-0' — it should now be the most-recently used.
    expect(embedCacheGet('k-0')).toEqual([0]);
    // Insert a new key — this evicts the OLDEST remaining, which is
    // k-1 (since k-0 just moved to the end).
    embedCacheSet('new', [-1]);
    expect(embedCacheSize()).toBe(1000);
    expect(embedCacheGet('k-0')).toEqual([0]); // touched, still present
    expect(embedCacheGet('k-1')).toBeUndefined(); // oldest, evicted
    expect(embedCacheGet('new')).toEqual([-1]);
  });
});

describe('clearEmbedCache + embedCacheSize', () => {
  it('starts at 0', () => {
    expect(embedCacheSize()).toBe(0);
  });

  it('reflects inserts and clears', () => {
    embedCacheSet('a', [1]);
    embedCacheSet('b', [2]);
    expect(embedCacheSize()).toBe(2);
    clearEmbedCache();
    expect(embedCacheSize()).toBe(0);
  });
});

describe('LRU eviction at 1000', () => {
  it('evicts the oldest entry when over capacity', () => {
    // Insert 1000 distinct keys, then a 1001st.  The first one is gone.
    for (let i = 0; i < 1000; i++) {
      embedCacheSet(`k-${i}`, [i]);
    }
    expect(embedCacheSize()).toBe(1000);
    embedCacheSet('k-1000', [1000]);
    expect(embedCacheSize()).toBe(1000);
    expect(embedCacheGet('k-0')).toBeUndefined();
    expect(embedCacheGet('k-1000')).toEqual([1000]);
  });
});
