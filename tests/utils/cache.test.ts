import { describe, it, expect } from 'vitest';
import { TTLCache, InflightDedup } from '@/lib/utils/cache';

describe('TTLCache', () => {
  it('stores and retrieves values', () => {
    const c = new TTLCache<string, number>(3, 1000);
    c.set('a', 1);
    expect(c.get('a')).toBe(1);
    expect(c.has('a')).toBe(true);
  });

  it('expires entries after ttl', async () => {
    const c = new TTLCache<string, number>(3, 30);
    c.set('a', 1);
    await new Promise((r) => setTimeout(r, 50));
    expect(c.get('a')).toBeUndefined();
    expect(c.has('a')).toBe(false);
  });

  it('evicts LRU when over capacity', () => {
    const c = new TTLCache<string, number>(2, 10_000);
    c.set('a', 1);
    c.set('b', 2);
    c.set('c', 3); // 'a' should be evicted
    expect(c.get('a')).toBeUndefined();
    expect(c.get('b')).toBe(2);
    expect(c.get('c')).toBe(3);
    expect(c.size).toBe(2);
  });

  it('updates LRU order on read', () => {
    const c = new TTLCache<string, number>(2, 10_000);
    c.set('a', 1);
    c.set('b', 2);
    c.get('a'); // 'a' is now most-recently used
    c.set('c', 3); // should evict 'b', not 'a'
    expect(c.get('a')).toBe(1);
    expect(c.get('b')).toBeUndefined();
    expect(c.get('c')).toBe(3);
  });

  it('tracks hit/miss stats', () => {
    const c = new TTLCache<string, number>(3, 10_000);
    c.set('a', 1);
    c.get('a');
    c.get('a');
    c.get('zz');
    const s = c.stats();
    expect(s.hits).toBe(2);
    expect(s.misses).toBe(1);
    expect(s.hitRate).toBeCloseTo(2 / 3, 5);
  });

  it('clears all entries', () => {
    const c = new TTLCache<string, number>(3, 10_000);
    c.set('a', 1);
    c.set('b', 2);
    c.clear();
    expect(c.size).toBe(0);
    expect(c.get('a')).toBeUndefined();
  });
});

describe('InflightDedup', () => {
  it('collapses concurrent calls to one promise', async () => {
    const d = new InflightDedup<number>();
    let calls = 0;
    const fn = async () => {
      calls++;
      await new Promise((r) => setTimeout(r, 20));
      return 42;
    };

    const [a, b, c] = await Promise.all([d.run('k', fn), d.run('k', fn), d.run('k', fn)]);
    expect(a).toBe(42);
    expect(b).toBe(42);
    expect(c).toBe(42);
    expect(calls).toBe(1);
  });

  it('allows a new call after the first resolves', async () => {
    const d = new InflightDedup<number>();
    let calls = 0;
    const fn = async () => {
      calls++;
      return calls;
    };
    const first = await d.run('k', fn);
    const second = await d.run('k', fn);
    expect(first).toBe(1);
    expect(second).toBe(2);
  });
});
