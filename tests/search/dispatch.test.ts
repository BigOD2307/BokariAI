import { describe, expect, it, vi, beforeEach } from 'vitest';

const searchWeb = vi.fn();
vi.mock('@/lib/retrieval', () => ({ searchWeb: (...a: unknown[]) => searchWeb(...a) }));
vi.mock('@/lib/youtube/cache', () => ({ cachedYouTubeSearch: vi.fn() }));
vi.mock('@/lib/social/cache', () => ({ cachedSocialSearch: vi.fn() }));

const { searchSearxng, searchNews } = await import('@/lib/search');

const emptyOutcome = { documents: [], used: [], failures: [] };

describe('search.ts dispatcher — intent routing (BUG-02/27)', () => {
  beforeEach(() => searchWeb.mockReset().mockResolvedValue(emptyOutcome));

  it('routes a plain query to general intent', async () => {
    await searchSearxng('capitale du mali');
    expect(searchWeb).toHaveBeenCalledWith(
      'capitale du mali',
      expect.objectContaining({ intent: 'general' }),
    );
  });

  it('routes engines:["news"] to news intent with a freshness window', async () => {
    await searchSearxng('actualite mali', { engines: ['news'] });
    expect(searchWeb).toHaveBeenCalledWith(
      'actualite mali',
      expect.objectContaining({ intent: 'news', maxAgeDays: 30 }),
    );
  });

  it('routes the legacy academic engines list to academic intent, not a plain web search (BUG-27)', async () => {
    await searchSearxng('quantum computing', { engines: ['arxiv', 'google scholar', 'pubmed'] });
    expect(searchWeb).toHaveBeenCalledWith(
      'quantum computing',
      expect.objectContaining({ intent: 'academic' }),
    );
  });

  it('adapts SearchDocument[] to the legacy {results,suggestions} shape', async () => {
    searchWeb.mockResolvedValue({
      documents: [
        {
          url: 'https://lefaso.net/a',
          canonicalUrl: 'https://lefaso.net/a',
          title: 'Titre',
          snippet: 'extrait',
          domain: 'lefaso.net',
          publishedAt: new Date('2026-06-01T00:00:00Z'),
          provider: 'serper',
          rank: 1,
        },
      ],
      used: ['serper'],
      failures: [],
    });

    const { results } = await searchSearxng('x');
    expect(results).toEqual([
      { title: 'Titre', url: 'https://lefaso.net/a', content: 'extrait', publishedAt: '2026-06-01T00:00:00.000Z' },
    ]);
  });

  it('searchNews always uses news intent', async () => {
    await searchNews('mali', 'fr');
    expect(searchWeb).toHaveBeenCalledWith(
      expect.stringContaining('mali'),
      expect.objectContaining({ intent: 'news' }),
    );
  });
});
