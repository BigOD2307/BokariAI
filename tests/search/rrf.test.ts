import { describe, it, expect } from 'vitest';
import { reciprocalRankFusion, type SearchResult } from '@/lib/search';

const r = (url: string, content = ''): SearchResult => ({
  title: url,
  url,
  content,
});

describe('search — Reciprocal Rank Fusion', () => {
  it('promotes a result that appears across multiple engines over a single top hit', () => {
    // docB is mid-ranked in engine A but top in B and C → strong consensus.
    // docA is rank-1 in engine A only. Consensus should beat the lone top hit.
    const ddg = [r('https://example.com/a'), r('https://example.com/b'), r('https://example.com/c')];
    const news = [r('https://example.com/b'), r('https://example.com/d')];
    const brave = [r('https://example.com/b'), r('https://example.com/e')];

    const fused = reciprocalRankFusion([ddg, news, brave]);
    expect(fused[0]!.url).toBe('https://example.com/b');
  });

  it('dedups by hostname+path and keeps the richer snippet', () => {
    const ddg = [r('https://example.com/b', 'short')];
    const news = [r('https://example.com/b', 'a much longer and richer snippet')];

    const fused = reciprocalRankFusion([ddg, news]);
    const b = fused.find((x) => x.url === 'https://example.com/b');
    expect(b).toBeDefined();
    expect(b!.content).toBe('a much longer and richer snippet');
    // appears once after dedup
    expect(fused.filter((x) => x.url === 'https://example.com/b')).toHaveLength(1);
  });

  it('breaks ties toward African domains', () => {
    // Both appear once at rank 1 in different engines → equal RRF. The African
    // domain boost should lift the African source above the foreign one.
    const engineA = [r('https://rfi.fr/news')];
    const engineB = [r('https://example.com/foreign')];

    const fused = reciprocalRankFusion([engineA, engineB]);
    expect(fused[0]!.url).toBe('https://rfi.fr/news');
  });

  it('tolerates malformed URLs without throwing', () => {
    const list = [r('not a url'), r('https://example.com/ok')];
    expect(() => reciprocalRankFusion([list])).not.toThrow();
    expect(reciprocalRankFusion([list])).toHaveLength(2);
  });
});
