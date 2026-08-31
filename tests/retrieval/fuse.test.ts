import { describe, expect, it } from 'vitest';
import { fuse } from '@/lib/retrieval';
import type { SearchDocument } from '@/lib/retrieval/types';

const doc = (over: Partial<SearchDocument>): SearchDocument => ({
  url: 'https://a.test/x',
  canonicalUrl: 'https://a.test/x',
  title: 't',
  snippet: '',
  domain: 'a.test',
  publishedAt: null,
  provider: 'p',
  rank: 1,
  ...over,
});

describe('fuse', () => {
  it('rewards genuine cross-provider consensus', () => {
    const shared = { canonicalUrl: 'https://shared.test/a', url: 'https://shared.test/a' };
    const out = fuse(
      [
        [doc({ ...shared, provider: 'serper' }), doc({ canonicalUrl: 'https://x.test/1', provider: 'serper' })],
        [doc({ canonicalUrl: 'https://y.test/2', provider: 'searxng' }), doc({ ...shared, provider: 'searxng' })],
      ],
      10,
    );
    expect(out[0].canonicalUrl).toBe('https://shared.test/a');
  });

  it('does not count the same provider twice for one URL (BUG-22)', () => {
    const same = { canonicalUrl: 'https://dup.test/a', url: 'https://dup.test/a', provider: 'serper' };
    const out = fuse(
      [[doc(same), doc(same)], [doc({ canonicalUrl: 'https://o.test/b', provider: 'searxng' })]],
      10,
    );
    expect(out).toHaveLength(2);
    expect(out[0].canonicalUrl).toBe('https://dup.test/a'); // rank 1 still wins, but only once
  });

  it('keeps the richest snippet and any date it finds', () => {
    const u = { canonicalUrl: 'https://a.test/x', url: 'https://a.test/x' };
    const when = new Date('2026-08-01');
    const out = fuse(
      [
        [doc({ ...u, provider: 'serper', snippet: 'court' })],
        [doc({ ...u, provider: 'searxng', snippet: 'un extrait bien plus long', publishedAt: when })],
      ],
      10,
    );
    expect(out[0].snippet).toBe('un extrait bien plus long');
    expect(out[0].publishedAt).toEqual(when);
  });

  it('breaks ties toward African domains', () => {
    // Both appear once at rank 1 in different providers → equal RRF. The
    // African-domain boost should lift the African source above the foreign one.
    const providerA = [doc({ canonicalUrl: 'https://rfi.fr/news', url: 'https://rfi.fr/news', domain: 'rfi.fr', provider: 'a' })];
    const providerB = [doc({ canonicalUrl: 'https://example.com/foreign', url: 'https://example.com/foreign', domain: 'example.com', provider: 'b' })];

    const out = fuse([providerA, providerB], 10);
    expect(out[0].canonicalUrl).toBe('https://rfi.fr/news');
  });

  it('respects the limit', () => {
    const list = Array.from({ length: 20 }, (_, i) =>
      doc({ canonicalUrl: `https://a.test/${i}`, url: `https://a.test/${i}`, provider: 'p' }),
    );
    expect(fuse([list], 5)).toHaveLength(5);
  });
});
