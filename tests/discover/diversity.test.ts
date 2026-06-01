/**
 * @module discover/diversity.test
 * @description Tests for the diversity cap (max per domain).
 */
import { describe, it, expect } from 'vitest';
import { applyDiversityCap } from '@/lib/discover/diversity';

type Item = { url: string; domain: string; rank: number };

describe('applyDiversityCap', () => {
  it('preserves the input order', () => {
    const items: Item[] = [
      { url: 'a', domain: 'x.com', rank: 1 },
      { url: 'b', domain: 'y.com', rank: 2 },
      { url: 'c', domain: 'z.com', rank: 3 },
    ];
    const out = applyDiversityCap(items, 2);
    expect(out.map((i) => i.url)).toEqual(['a', 'b', 'c']);
  });

  it('keeps at most maxPerDomain items per domain', () => {
    const items: Item[] = [
      { url: 'a', domain: 'spam.com', rank: 1 },
      { url: 'b', domain: 'spam.com', rank: 2 },
      { url: 'c', domain: 'spam.com', rank: 3 },
      { url: 'd', domain: 'spam.com', rank: 4 },
    ];
    const out = applyDiversityCap(items, 2);
    const fromSpam = out.filter((i) => i.domain === 'spam.com');
    expect(fromSpam).toHaveLength(2);
    expect(fromSpam.map((i) => i.url)).toEqual(['a', 'b']); // top 2 by rank
  });

  it('does not touch other domains when capping one', () => {
    const items: Item[] = [
      { url: 'a', domain: 'spam.com', rank: 1 },
      { url: 'b', domain: 'spam.com', rank: 2 },
      { url: 'c', domain: 'spam.com', rank: 3 },
      { url: 'd', domain: 'good.com', rank: 4 },
      { url: 'e', domain: 'news.org', rank: 5 },
    ];
    const out = applyDiversityCap(items, 2);
    expect(out).toHaveLength(4);
    expect(out.map((i) => i.domain)).toEqual(['spam.com', 'spam.com', 'good.com', 'news.org']);
  });

  it('returns the original list when maxPerDomain is Infinity', () => {
    const items: Item[] = [
      { url: 'a', domain: 'x.com', rank: 1 },
      { url: 'b', domain: 'x.com', rank: 2 },
      { url: 'c', domain: 'x.com', rank: 3 },
    ];
    const out = applyDiversityCap(items, Number.POSITIVE_INFINITY);
    expect(out).toEqual(items);
  });

  it('returns empty for empty input', () => {
    expect(applyDiversityCap<Item>([], 2)).toEqual([]);
  });

  it('treats empty-domain items as one bucket', () => {
    const items: Item[] = [
      { url: 'a', domain: '', rank: 1 },
      { url: 'b', domain: '', rank: 2 },
      { url: 'c', domain: '', rank: 3 },
    ];
    const out = applyDiversityCap(items, 2);
    expect(out).toHaveLength(2);
  });

  it('normalises domain casing', () => {
    const items: Item[] = [
      { url: 'a', domain: 'Example.com', rank: 1 },
      { url: 'b', domain: 'example.com', rank: 2 },
      { url: 'c', domain: 'EXAMPLE.com', rank: 3 },
    ];
    const out = applyDiversityCap(items, 2);
    expect(out).toHaveLength(2);
  });

  it('handles cap of 1 (strict diversity)', () => {
    const items: Item[] = [
      { url: 'a', domain: 'x.com', rank: 1 },
      { url: 'b', domain: 'x.com', rank: 2 },
      { url: 'c', domain: 'y.com', rank: 3 },
    ];
    const out = applyDiversityCap(items, 1);
    expect(out.map((i) => i.url)).toEqual(['a', 'c']);
  });
});
