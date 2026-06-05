/**
 * @module tests/social/socialSearch
 * @description Unit tests for the social_search research action: the
 * enabled-gate (per-network sources + classifier booleans, plus the legacy
 * discussions→Reddit mapping) and the Chunk emit flow with a mocked
 * searchSearxng.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ClassifierOutput, SearchSources } from '@/lib/agents/search/types';

const searchSearxngMock = vi.fn(async (_q: string, opts?: any) => ({
  results: [
    {
      title: `result for ${opts?.engines?.[0]}`,
      url: `https://${opts?.engines?.[0]}.example/1`,
      content: 'snippet',
    },
  ],
  suggestions: [],
}));

vi.mock('@/lib/search', () => ({
  searchSearxng: (query: string, opts?: any) => searchSearxngMock(query, opts),
}));

import socialSearchAction from '@/lib/agents/search/researcher/actions/socialSearch';

const baseClassification = (
  over: Partial<ClassifierOutput['classification']> = {},
): ClassifierOutput => ({
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
    ...over,
  },
  standaloneFollowUp: '',
  complexity: 'complex',
});

function makeSession() {
  const block = { type: 'research', data: { subSteps: [] as any[] } };
  return {
    session: {
      getBlock: vi.fn(() => block),
      updateBlock: vi.fn(),
    },
    block,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('socialSearchAction.enabled', () => {
  it('is disabled when search is skipped', () => {
    expect(
      socialSearchAction.enabled({
        classification: baseClassification({ skipSearch: true, xSearch: true }),
        fileIds: [],
        mode: 'balanced',
        sources: ['x'] as SearchSources[],
      }),
    ).toBe(false);
  });

  it('is disabled when no social source toggle is on', () => {
    expect(
      socialSearchAction.enabled({
        classification: baseClassification({ xSearch: true, redditSearch: true }),
        fileIds: [],
        mode: 'balanced',
        sources: ['web'] as SearchSources[],
      }),
    ).toBe(false);
  });

  it('is enabled when a network is both selected and classified', () => {
    expect(
      socialSearchAction.enabled({
        classification: baseClassification({ xSearch: true }),
        fileIds: [],
        mode: 'balanced',
        sources: ['x'] as SearchSources[],
      }),
    ).toBe(true);
  });

  it('preserves legacy discussions→Reddit mapping', () => {
    expect(
      socialSearchAction.enabled({
        classification: baseClassification({ discussionSearch: true }),
        fileIds: [],
        mode: 'balanced',
        sources: ['discussions'] as SearchSources[],
      }),
    ).toBe(true);
  });

  it('requires the classifier boolean even when the source is selected', () => {
    expect(
      socialSearchAction.enabled({
        classification: baseClassification({ xSearch: false }),
        fileIds: [],
        mode: 'balanced',
        sources: ['x'] as SearchSources[],
      }),
    ).toBe(false);
  });
});

describe('socialSearchAction.execute', () => {
  it('fans out over enabled networks and emits Chunks', async () => {
    const { session, block } = makeSession();
    const result = await socialSearchAction.execute(
      { queries: ['engrais'] },
      {
        session: session as any,
        researchBlockId: 'rb-1',
        fileIds: [],
        llm: {} as any,
        embedding: {} as any,
        sources: ['x', 'reddit'] as SearchSources[],
        classification: baseClassification({ xSearch: true, redditSearch: true }),
      },
    );

    expect(result.type).toBe('search_results');
    if (result.type !== 'search_results') return;

    // Two networks x one query = two searchSearxng calls.
    expect(searchSearxngMock).toHaveBeenCalledTimes(2);
    const engines = searchSearxngMock.mock.calls.map((c: any[]) => c[1].engines[0]);
    expect(engines).toContain('x');
    expect(engines).toContain('reddit');

    // Chunks carry title + url metadata.
    expect(result.results.length).toBeGreaterThan(0);
    for (const chunk of result.results) {
      expect(chunk.metadata.url).toBeTruthy();
      expect(chunk.metadata.title).toBeTruthy();
    }

    // Sub-steps emitted verbatim (searching + search_results).
    const types = block.data.subSteps.map((s: any) => s.type);
    expect(types).toContain('searching');
    expect(types).toContain('search_results');
  });

  it('defaults to Reddit when no source/classification context is threaded', async () => {
    const { session } = makeSession();
    const result = await socialSearchAction.execute(
      { queries: ['q'] },
      {
        session: session as any,
        researchBlockId: 'rb-1',
        fileIds: [],
        llm: {} as any,
        embedding: {} as any,
      },
    );
    if (result.type !== 'search_results') throw new Error('wrong type');
    expect(searchSearxngMock).toHaveBeenCalledTimes(1);
    expect((searchSearxngMock.mock.calls[0] as any[])[1].engines[0]).toBe('reddit');
  });

  it('caps fan-out at 9 calls (networks x queries)', async () => {
    const { session } = makeSession();
    await socialSearchAction.execute(
      { queries: ['a', 'b', 'c', 'd'] }, // sliced to 3 queries upstream
      {
        session: session as any,
        researchBlockId: 'rb-1',
        fileIds: [],
        llm: {} as any,
        embedding: {} as any,
        sources: ['x', 'reddit', 'linkedin'] as SearchSources[],
        classification: baseClassification({
          xSearch: true,
          redditSearch: true,
          linkedinSearch: true,
        }),
      },
    );
    // 3 networks x 3 queries = 9, capped at MAX_SOCIAL_CALLS.
    expect(searchSearxngMock).toHaveBeenCalledTimes(9);
  });
});
