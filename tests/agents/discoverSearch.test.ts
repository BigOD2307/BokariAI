/**
 * @module agents/search/researcher/actions/discoverSearch.test
 * @description Unit tests for the discover_search action with
 * mocked dependencies.  We do not hit the network; the AI gateway
 * and Supabase client are both stubbed at the module boundary.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the AI gateway: returns a deterministic unit vector for any input.
vi.mock('@/lib/ai/gateway', () => ({
  embed: vi.fn(async (texts: string[]) =>
    texts.map((_t, i) => {
      // Each query gets a distinct direction so the ranker can disambiguate.
      const v = [0, 0, 0];
      v[i % 3] = 1;
      return v;
    }),
  ),
}));

// Mock the Supabase discover query: return a fixed candidate set.
vi.mock('@/lib/supabase/queries/discover', () => ({
  getEmbeddedDiscoverCandidates: vi.fn(async () => [
    {
      id: 'a',
      title: 'Bamako election',
      url: 'https://rfi.fr/bamako',
      domain: 'rfi.fr',
      language: 'fr',
      publishedAt: new Date('2026-06-01T10:00:00Z'),
      topic: 'africa',
      fullContent: 'Le nouveau président prête serment à Bamako.',
      embedding: [1, 0, 0], // matches first query
    },
    {
      id: 'b',
      title: 'Bamako inauguration',
      url: 'https://bbc.com/bamako',
      domain: 'bbc.com',
      language: 'fr',
      publishedAt: new Date('2026-06-01T08:00:00Z'),
      topic: 'africa',
      fullContent: 'Bamako : nouveau président, discours inaugural.',
      embedding: [1, 0, 0.01], // almost matches first query
    },
    {
      id: 'c',
      title: 'Ethereum staking',
      url: 'https://cointelegraph.com/eth',
      domain: 'cointelegraph.com',
      language: 'en',
      publishedAt: new Date('2026-06-01T09:00:00Z'),
      topic: 'tech',
      fullContent: 'Ethereum staking rewards hit a new high in Q2.',
      embedding: [0, 1, 0], // matches second query
    },
    {
      id: 'd',
      title: 'Bamako unrelated',
      url: 'https://example.com/d',
      domain: 'example.com',
      language: 'fr',
      publishedAt: new Date('2026-05-30T00:00:00Z'),
      topic: 'africa',
      fullContent: 'Some other Bamako content.',
      embedding: [-1, 0, 0], // opposite of first query
    },
  ]),
}));

// Mock the session manager.
function makeSession() {
  const block = {
    type: 'research',
    data: { subSteps: [] as any[] },
  };
  return {
    session: {
      getBlock: vi.fn(() => block),
      updateBlock: vi.fn(),
    },
    block,
  };
}

import discoverSearchAction from '@/lib/agents/search/researcher/actions/discoverSearch';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('discoverSearchAction', () => {
  it('exposes a stable tool name', () => {
    expect(discoverSearchAction.name).toBe('discover_search');
  });

  it('describes the tool for the LLM', () => {
    const desc = discoverSearchAction.getToolDescription({ mode: 'balanced' });
    expect(desc).toMatch(/discover/i);
    expect(desc.length).toBeGreaterThan(40);
  });

  it('is enabled when search is not skipped', () => {
    const enabled = discoverSearchAction.enabled({
      classification: {
        classification: {
          skipSearch: false,
          personalSearch: false,
          academicSearch: false,
          discussionSearch: false,
          xSearch: false,
          redditSearch: false,
          linkedinSearch: false,
          youtubeSearch: false,
          showWeatherWidget: false,
          showStockWidget: false,
          showCalculationWidget: false,
        },
        standaloneFollowUp: '',
        complexity: 'complex',
      },
      fileIds: [],
      mode: 'balanced',
      sources: ['web'],
    });
    expect(enabled).toBe(true);
  });

  it('is disabled when search is skipped', () => {
    const enabled = discoverSearchAction.enabled({
      classification: {
        classification: {
          skipSearch: true,
          personalSearch: false,
          academicSearch: false,
          discussionSearch: false,
          xSearch: false,
          redditSearch: false,
          linkedinSearch: false,
          youtubeSearch: false,
          showWeatherWidget: false,
          showStockWidget: false,
          showCalculationWidget: false,
        },
        standaloneFollowUp: '',
        complexity: 'complex',
      },
      fileIds: [],
      mode: 'balanced',
      sources: ['web'],
    });
    expect(enabled).toBe(false);
  });

  it('returns cosine-ranked chunks with citation metadata', async () => {
    const { session, block } = makeSession();
    const result = await discoverSearchAction.execute(
      { queries: ['Bamako president'], limit: 5, minScore: 0.55 },
      {
        session: session as any,
        researchBlockId: 'rb-1',
        fileIds: [],
        llm: {} as any,
        embedding: {} as any,
      },
    );

    expect(result.type).toBe('search_results');
    if (result.type !== 'search_results') return;

    // First query embedding is [1, 0, 0] (from mock).  Candidates:
    //   a: [1, 0, 0]     → cos=1,   score=1.0    ← best
    //   b: [1, 0, 0.01]  → cos≈1,   score≈1.0    ← close
    //   c: [0, 1, 0]     → cos=0,   score=0.5    ← filtered (below 0.55)
    //   d: [-1, 0, 0]    → cos=-1,  score=0.0    ← filtered
    // So we should get exactly [a, b] in that order.
    expect(result.results).toHaveLength(2);
    expect(result.results[0].metadata.url).toBe('https://rfi.fr/bamako');
    expect(result.results[1].metadata.url).toBe('https://bbc.com/bamako');

    // All results should be marked as Bokari-cited
    for (const r of result.results) {
      expect((r.metadata as any).source).toBe('bokari-discover');
      expect((r.metadata as any).score).toBeGreaterThan(0.55);
    }

    // Should have pushed "searching" and "search_results" sub-steps
    const types = block.data.subSteps.map((s) => s.type);
    expect(types).toContain('searching');
    expect(types).toContain('search_results');
  });

  it('merges hits across multiple queries by max score', async () => {
    const { session } = makeSession();
    const result = await discoverSearchAction.execute(
      { queries: ['Bamako president', 'Ethereum staking'], limit: 5, minScore: 0.55 },
      {
        session: session as any,
        researchBlockId: 'rb-1',
        fileIds: [],
        llm: {} as any,
        embedding: {} as any,
      },
    );

    if (result.type !== 'search_results') throw new Error('wrong type');
    // Query 0 → [1, 0, 0] matches a (1.0), b (≈1.0); d is filtered (cos=-1)
    // Query 1 → [0, 1, 0] matches c (1.0)
    // Total unique: 3
    const urls = result.results.map((r) => r.metadata.url);
    expect(urls).toContain('https://rfi.fr/bamako');
    expect(urls).toContain('https://bbc.com/bamako');
    expect(urls).toContain('https://cointelegraph.com/eth');
    expect(urls).not.toContain('https://example.com/d');
    expect(result.results).toHaveLength(3);
  });

  it('returns [] when the gateway throws (degraded, not fatal)', async () => {
    const { embed } = await import('@/lib/ai/gateway');
    (embed as any).mockRejectedValueOnce(new Error('OpenRouter down'));

    const { session } = makeSession();
    const result = await discoverSearchAction.execute(
      { queries: ['anything'] },
      {
        session: session as any,
        researchBlockId: 'rb-1',
        fileIds: [],
        llm: {} as any,
        embedding: {} as any,
      },
    );
    if (result.type !== 'search_results') throw new Error('wrong type');
    expect(result.results).toEqual([]);
  });

  it('returns [] when there are no embedded candidates', async () => {
    const { getEmbeddedDiscoverCandidates } = await import(
      '@/lib/supabase/queries/discover'
    );
    (getEmbeddedDiscoverCandidates as any).mockResolvedValueOnce([]);

    const { session } = makeSession();
    const result = await discoverSearchAction.execute(
      { queries: ['Bamako'] },
      {
        session: session as any,
        researchBlockId: 'rb-1',
        fileIds: [],
        llm: {} as any,
        embedding: {} as any,
      },
    );
    if (result.type !== 'search_results') throw new Error('wrong type');
    expect(result.results).toEqual([]);
  });

  it('respects the limit option', async () => {
    const { session } = makeSession();
    const result = await discoverSearchAction.execute(
      { queries: ['Bamako'], limit: 1, minScore: 0.5 },
      {
        session: session as any,
        researchBlockId: 'rb-1',
        fileIds: [],
        llm: {} as any,
        embedding: {} as any,
      },
    );
    if (result.type !== 'search_results') throw new Error('wrong type');
    expect(result.results).toHaveLength(1);
  });
});
