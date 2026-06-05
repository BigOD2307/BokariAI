/**
 * @module tests/social/site
 * @description Unit tests for the site-operator social adapter. Mocks
 * `searchSearxng` at the module boundary and asserts the injected `site:`
 * operator and the non-throwing contract.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const searchSearxngMock = vi.fn(async (_query: string, _opts?: any) => ({
  results: [
    { title: 'Post', url: 'https://reddit.com/r/x/1', content: 'body' },
    { title: 'Post2', url: 'https://reddit.com/r/x/2' },
  ],
  suggestions: [],
}));

vi.mock('@/lib/search', () => ({
  searchSearxng: (query: string, opts?: any) => searchSearxngMock(query, opts),
}));

import { buildSiteQuery, createSiteProvider } from '@/lib/social/adapters/site';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('social/adapters/site', () => {
  it('builds the correct site: operator per network', () => {
    expect(buildSiteQuery('x', 'prix engrais')).toBe(
      '(site:x.com OR site:twitter.com) prix engrais',
    );
    expect(buildSiteQuery('reddit', 'prix engrais')).toBe(
      'site:reddit.com prix engrais',
    );
    expect(buildSiteQuery('linkedin', 'prix engrais')).toBe(
      '(site:linkedin.com/posts OR site:linkedin.com/pulse) prix engrais',
    );
  });

  it('delegates to searchSearxng with the scoped query', async () => {
    const provider = createSiteProvider('reddit');
    const out = await provider.search('engrais Sénégal', { language: 'fr' });

    expect(searchSearxngMock).toHaveBeenCalledTimes(1);
    const [q, opts] = searchSearxngMock.mock.calls[0] as any[];
    expect(q).toBe('site:reddit.com engrais Sénégal');
    expect(opts).toMatchObject({ language: 'fr' });
    expect(out.results).toHaveLength(2);
    expect(out.results[0].url).toContain('reddit.com');
  });

  it('respects maxResults', async () => {
    const provider = createSiteProvider('x');
    const out = await provider.search('q', { maxResults: 1 });
    expect(out.results).toHaveLength(1);
  });

  it('never throws — returns empty on underlying failure', async () => {
    searchSearxngMock.mockRejectedValueOnce(new Error('engine down'));
    const provider = createSiteProvider('linkedin');
    const out = await provider.search('q');
    expect(out.results).toEqual([]);
    expect(out.suggestions).toEqual([]);
  });
});
