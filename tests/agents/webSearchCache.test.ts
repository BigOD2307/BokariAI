/**
 * Tests for the webSearch action's content-fetch cache behavior.
 *
 * When pre-extracted content exists in the Discover cache, the action
 * should use it instead of re-fetching the URL.  This is the Phase 2
 * payoff: faster queries, no duplicate network calls.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/search', () => ({ searchSearxng: vi.fn() }));
vi.mock('@/lib/supabase/queries', () => ({ getStoredContentForUrls: vi.fn() }));
vi.mock('@/lib/utils/extractContent', () => ({ fetchMultipleContent: vi.fn() }));

import webSearchAction from '@/lib/agents/search/researcher/actions/webSearch';
import { searchSearxng } from '@/lib/search';
import { getStoredContentForUrls } from '@/lib/supabase/queries';
import { fetchMultipleContent } from '@/lib/utils/extractContent';
import type SessionManager from '@/lib/session';
import type { Chunk } from '@/lib/types';
import type { ActionOutput, SearchActionOutput } from '@/lib/agents/search/types';

const mockSearch = searchSearxng as unknown as ReturnType<typeof vi.fn>;
const mockGetStored = getStoredContentForUrls as unknown as ReturnType<typeof vi.fn>;
const mockFetchMultiple = fetchMultipleContent as unknown as ReturnType<typeof vi.fn>;

function makeSessionStub(): SessionManager {
  return {
    getBlock: vi.fn().mockReturnValue(null),
    updateBlock: vi.fn(),
  } as unknown as SessionManager;
}

function makeConfig(mode: 'speed' | 'balanced' | 'quality' = 'balanced') {
  return {
    mode,
    sources: ['web'] as Array<'web'>,
    classification: { classification: { skipSearch: false } },
    session: makeSessionStub(),
    researchBlockId: 'rb-1',
  } as any;
}

function getChunks(out: ActionOutput): Chunk[] {
  if (out.type === 'search_results') {
    return (out as SearchActionOutput).results;
  }
  return [];
}

beforeEach(() => {
  mockSearch.mockReset();
  mockGetStored.mockReset();
  mockFetchMultiple.mockReset();

  // Default: no cache, no fetch — tests override as needed
  mockGetStored.mockResolvedValue(new Map());
  mockFetchMultiple.mockResolvedValue(new Map());
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('webSearch action — Discover cache', () => {
  it('skips fetchMultipleContent entirely when every URL is cached', async () => {
    mockSearch.mockResolvedValue({
      results: [
        { title: 'Cached A', url: 'https://cached-a.com/1', content: 'snippet A' },
        { title: 'Cached B', url: 'https://cached-b.com/1', content: 'snippet B' },
      ],
    });
    mockGetStored.mockResolvedValue(
      new Map([
        ['https://cached-a.com/1', { fullContent: 'FULL A from cache', author: null, publishedAt: null, contentHash: null, extractedAt: null }],
        ['https://cached-b.com/1', { fullContent: 'FULL B from cache', author: null, publishedAt: null, contentHash: null, extractedAt: null }],
      ]),
    );

    const result = await webSearchAction.execute(
      { type: 'web_search', queries: ['q'] },
      makeConfig('balanced'),
    );

    expect(mockFetchMultiple).not.toHaveBeenCalled();
    expect(result.type).toBe('search_results');
    const chunks = getChunks(result);
    const a = chunks.find((r) => r.metadata.url === 'https://cached-a.com/1');
    const b = chunks.find((r) => r.metadata.url === 'https://cached-b.com/1');
    expect(a?.content).toContain('FULL A from cache');
    expect(b?.content).toContain('FULL B from cache');
  });

  it('only fetches the URLs missing from cache', async () => {
    mockSearch.mockResolvedValue({
      results: [
        { title: 'Cached', url: 'https://cached.com/1', content: 'snippet' },
        { title: 'Miss', url: 'https://miss.com/1', content: 'snippet' },
      ],
    });
    mockGetStored.mockResolvedValue(
      new Map([
        ['https://cached.com/1', { fullContent: 'FULL CACHED', author: null, publishedAt: null, contentHash: null, extractedAt: null }],
      ]),
    );
    mockFetchMultiple.mockResolvedValue(
      new Map([['https://miss.com/1', 'FULL FETCHED']]),
    );

    const result = await webSearchAction.execute(
      { type: 'web_search', queries: ['q'] },
      makeConfig('balanced'),
    );

    // Only the miss should have been fetched
    expect(mockFetchMultiple).toHaveBeenCalledTimes(1);
    const fetchedArg = mockFetchMultiple.mock.calls[0][0] as string[];
    expect(fetchedArg).toEqual(['https://miss.com/1']);

    const chunks = getChunks(result);
    const a = chunks.find((r) => r.metadata.url === 'https://cached.com/1');
    const b = chunks.find((r) => r.metadata.url === 'https://miss.com/1');
    expect(a?.content).toContain('FULL CACHED');
    expect(b?.content).toContain('FULL FETCHED');
  });

  it('falls back to live fetch when the cache lookup itself errors (does not crash)', async () => {
    mockSearch.mockResolvedValue({
      results: [{ title: 'X', url: 'https://x.com/1', content: 'snippet' }],
    });
    mockGetStored.mockRejectedValue(new Error('Supabase is down'));
    mockFetchMultiple.mockResolvedValue(new Map([['https://x.com/1', 'FULL LIVE']]));

    const result = await webSearchAction.execute(
      { type: 'web_search', queries: ['q'] },
      makeConfig('balanced'),
    );

    // The action should not throw; it should fall back to live fetch.
    expect(mockFetchMultiple).toHaveBeenCalled();
    const fetchedArg = mockFetchMultiple.mock.calls[0][0] as string[];
    expect(fetchedArg).toContain('https://x.com/1');
    const chunks = getChunks(result);
    const x = chunks.find((r) => r.metadata.url === 'https://x.com/1');
    expect(x?.content).toContain('FULL LIVE');
  });

  it('respects mode-based maxFetch (speed=2, balanced=4, quality=6)', async () => {
    const manyUrls = Array.from({ length: 10 }, (_, i) => ({
      title: `T${i}`,
      url: `https://example.com/${i}`,
      content: `snippet ${i}`,
    }));
    mockSearch.mockResolvedValue({ results: manyUrls });

    for (const [mode, expected] of [
      ['speed', 2],
      ['balanced', 4],
      ['quality', 6],
    ] as const) {
      mockGetStored.mockClear();
      mockFetchMultiple.mockClear();
      mockGetStored.mockResolvedValue(new Map());

      await webSearchAction.execute(
        { type: 'web_search', queries: ['q'] },
        makeConfig(mode),
      );

      const fetchedUrls = (mockFetchMultiple.mock.calls[0]?.[0] as string[]) ?? [];
      expect(fetchedUrls.length, `mode=${mode}`).toBeLessThanOrEqual(expected);
    }
  });

  it('does not call getStoredContentForUrls when there are no URLs to read', async () => {
    mockSearch.mockResolvedValue({ results: [] });

    const result = await webSearchAction.execute(
      { type: 'web_search', queries: ['q'] },
      makeConfig('balanced'),
    );

    expect(result.type).toBe('search_results');
    expect(mockGetStored).not.toHaveBeenCalled();
  });
});
