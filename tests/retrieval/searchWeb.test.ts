import { describe, expect, it, vi, beforeEach } from 'vitest';

const searxngSearch = vi.fn();
const searxngConfigured = vi.fn(() => true);
const serperSearch = vi.fn();
const serperConfigured = vi.fn(() => true);
const tinyfishSearch = vi.fn();
const tinyfishConfigured = vi.fn(() => true);

vi.mock('@/lib/retrieval/providers/searxng', () => ({
  SearxngProvider: class {
    name = 'searxng';
    isConfigured = searxngConfigured;
    search = searxngSearch;
  },
}));
vi.mock('@/lib/retrieval/providers/serper', () => ({
  SerperProvider: class {
    name = 'serper';
    isConfigured = serperConfigured;
    search = serperSearch;
  },
}));
vi.mock('@/lib/retrieval/providers/tinyfish', () => ({
  TinyFishProvider: class {
    name = 'tinyfish';
    isConfigured = tinyfishConfigured;
    search = tinyfishSearch;
  },
}));

const { searchWeb } = await import('@/lib/retrieval');

const docs = (n: number, provider: string) =>
  Array.from({ length: n }, (_, i) => ({
    url: `https://${provider}.test/${i}`,
    canonicalUrl: `https://${provider}.test/${i}`,
    title: `t${i}`,
    snippet: '',
    domain: `${provider}.test`,
    publishedAt: null,
    provider,
    rank: i + 1,
  }));

describe('searchWeb', () => {
  beforeEach(() => {
    searxngSearch.mockReset();
    serperSearch.mockReset();
    tinyfishSearch.mockReset();
    searxngConfigured.mockReturnValue(true);
    serperConfigured.mockReturnValue(true);
    tinyfishConfigured.mockReturnValue(true);
  });

  it('leads with Serper for news intent (the only provider with real per-result dates)', async () => {
    serperSearch.mockResolvedValue(docs(8, 'serper'));

    const outcome = await searchWeb('mali actualite', { intent: 'news', language: 'fr', limit: 10 });

    expect(outcome.used).toEqual(['serper']);
    expect(tinyfishSearch).not.toHaveBeenCalled();
    expect(searxngSearch).not.toHaveBeenCalled();
  });

  it('leads with SearXNG for general intent, falling through to TinyFish and Serper only on a miss', async () => {
    searxngSearch.mockResolvedValue([]);
    tinyfishSearch.mockResolvedValue(docs(8, 'tinyfish'));

    const outcome = await searchWeb('mali histoire', { intent: 'general', language: 'fr', limit: 10 });

    expect(outcome.used).toEqual(['tinyfish']);
    expect(serperSearch).not.toHaveBeenCalled();
    expect(outcome.failures).toEqual([{ provider: 'searxng', reason: 'empty' }]);
  });

  it('only uses TinyFish for academic intent', async () => {
    tinyfishSearch.mockResolvedValue(docs(3, 'tinyfish'));

    const outcome = await searchWeb('quantum computing papers', { intent: 'academic', language: 'en', limit: 10 });

    expect(outcome.used).toEqual(['tinyfish']);
    expect(serperSearch).not.toHaveBeenCalled();
    expect(searxngSearch).not.toHaveBeenCalled();
  });

  it('skips an unconfigured provider silently and records failures for thrown errors', async () => {
    serperConfigured.mockReturnValue(false);
    tinyfishSearch.mockRejectedValue(new Error('rate limited'));
    searxngSearch.mockResolvedValue(docs(8, 'searxng'));

    const outcome = await searchWeb('mali actualite', { intent: 'news', language: 'fr', limit: 10 });

    expect(outcome.used).toEqual(['searxng']);
    expect(outcome.failures).toEqual([{ provider: 'tinyfish', reason: 'rate limited' }]);
  });

  it('stops calling further providers once enough results have accumulated', async () => {
    searxngSearch.mockResolvedValue(docs(6, 'searxng'));

    const outcome = await searchWeb('x', { intent: 'general', language: 'fr', limit: 10 });

    expect(outcome.used).toEqual(['searxng']);
    expect(tinyfishSearch).not.toHaveBeenCalled();
    expect(serperSearch).not.toHaveBeenCalled();
  });

  it('returns an empty outcome with all failures when every provider misses', async () => {
    searxngSearch.mockResolvedValue([]);
    tinyfishSearch.mockResolvedValue([]);
    serperSearch.mockResolvedValue([]);

    const outcome = await searchWeb('x', { intent: 'general', language: 'fr', limit: 10 });

    expect(outcome.documents).toEqual([]);
    expect(outcome.used).toEqual([]);
    expect(outcome.failures).toHaveLength(3);
  });
});
