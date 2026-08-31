import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

const searchSearxng = vi.fn();
vi.mock('@/lib/searxng', () => ({ searchSearxng: (...a: unknown[]) => searchSearxng(...a) }));

const { SearxngProvider } = await import('@/lib/retrieval/providers/searxng');

describe('SearxngProvider (retrieval wrapper)', () => {
  beforeEach(() => {
    searchSearxng.mockReset();
    vi.stubEnv('SEARXNG_API_URL', 'http://localhost:8080');
  });
  afterEach(() => vi.unstubAllEnvs());

  it('is unconfigured without SEARXNG_API_URL', () => {
    vi.stubEnv('SEARXNG_API_URL', '');
    expect(new SearxngProvider().isConfigured()).toBe(false);
  });

  it('maps results, drops entries with no url/title, and parses publishedDate', async () => {
    searchSearxng.mockResolvedValue({
      results: [
        { title: 'A', url: 'https://lefaso.net/a', content: 'snippet', publishedDate: '2026-06-01' },
        { title: 'no url' },
        { url: 'https://x.test/b' },
      ],
      suggestions: [],
    });

    const docs = await new SearxngProvider().search('mali', {
      intent: 'general',
      language: 'fr',
      limit: 10,
    });

    expect(docs).toHaveLength(1);
    expect(docs[0]).toMatchObject({ title: 'A', url: 'https://lefaso.net/a', domain: 'lefaso.net' });
    expect(docs[0].publishedAt).toBeInstanceOf(Date);
  });

  it('passes categories=news for news intent and a time_range for maxAgeDays', async () => {
    searchSearxng.mockResolvedValue({ results: [], suggestions: [] });

    await new SearxngProvider().search('mali actualite', {
      intent: 'news',
      language: 'fr',
      maxAgeDays: 1,
      limit: 10,
    });

    expect(searchSearxng).toHaveBeenCalledWith(
      'mali actualite',
      expect.objectContaining({ categories: ['news'], time_range: 'day' }),
    );
  });

  it('respects the limit', async () => {
    const many = Array.from({ length: 20 }, (_, i) => ({
      title: `T${i}`,
      url: `https://a.test/${i}`,
      content: '',
    }));
    searchSearxng.mockResolvedValue({ results: many, suggestions: [] });

    const docs = await new SearxngProvider().search('x', { intent: 'general', language: 'fr', limit: 3 });
    expect(docs).toHaveLength(3);
  });
});
