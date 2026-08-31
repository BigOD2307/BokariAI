/**
 * Tests for the webSearch action's content-fetch cache and passage-selection
 * behavior.
 *
 * When pre-extracted content exists in the Discover cache, the action should
 * use it instead of re-reading the URL (readPage). Whatever content it ends
 * up with — cached or freshly read — only the passages BM25-relevant to the
 * query are injected into the result, not the whole page (C5).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/search', () => ({ searchSearxng: vi.fn() }));
vi.mock('@/lib/supabase/queries', () => ({ getStoredContentForUrls: vi.fn() }));
vi.mock('@/lib/retrieval/read', () => ({ readPages: vi.fn() }));

import webSearchAction from '@/lib/agents/search/researcher/actions/webSearch';
import { searchSearxng } from '@/lib/search';
import { getStoredContentForUrls } from '@/lib/supabase/queries';
import { readPages } from '@/lib/retrieval/read';
import type SessionManager from '@/lib/session';
import type { Chunk } from '@/lib/types';
import type { ActionOutput, SearchActionOutput } from '@/lib/agents/search/types';

const mockSearch = searchSearxng as unknown as ReturnType<typeof vi.fn>;
const mockGetStored = getStoredContentForUrls as unknown as ReturnType<typeof vi.fn>;
const mockReadPages = readPages as unknown as ReturnType<typeof vi.fn>;

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

const page = (url: string, text: string) => ({
  url,
  title: null,
  text,
  publishedAt: null,
  author: null,
  bytes: 0,
});

beforeEach(() => {
  mockSearch.mockReset();
  mockGetStored.mockReset();
  mockReadPages.mockReset();

  // Default: no cache, no fresh pages — tests override as needed
  mockGetStored.mockResolvedValue(new Map());
  mockReadPages.mockResolvedValue(new Map());
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('webSearch action — Discover cache + passage selection', () => {
  it('skips readPages entirely when every URL is cached', async () => {
    mockSearch.mockResolvedValue({
      results: [
        { title: 'Cached A', url: 'https://cached-a.com/1', content: 'snippet A' },
        { title: 'Cached B', url: 'https://cached-b.com/1', content: 'snippet B' },
      ],
    });
    mockGetStored.mockResolvedValue(
      new Map([
        ['https://cached-a.com/1', { fullContent: 'FULL A from cache '.repeat(10), author: null, publishedAt: null, contentHash: null, extractedAt: null }],
        ['https://cached-b.com/1', { fullContent: 'FULL B from cache '.repeat(10), author: null, publishedAt: null, contentHash: null, extractedAt: null }],
      ]),
    );

    const result = await webSearchAction.execute(
      { type: 'web_search', queries: ['q'] },
      makeConfig('balanced'),
    );

    expect(mockReadPages).not.toHaveBeenCalled();
    expect(result.type).toBe('search_results');
    const chunks = getChunks(result);
    const a = chunks.find((r) => r.metadata.url === 'https://cached-a.com/1');
    const b = chunks.find((r) => r.metadata.url === 'https://cached-b.com/1');
    expect(a?.content).toContain('FULL A from cache');
    expect(b?.content).toContain('FULL B from cache');
  });

  it('only reads the URLs missing from cache', async () => {
    mockSearch.mockResolvedValue({
      results: [
        { title: 'Cached', url: 'https://cached.com/1', content: 'snippet' },
        { title: 'Miss', url: 'https://miss.com/1', content: 'snippet' },
      ],
    });
    mockGetStored.mockResolvedValue(
      new Map([
        ['https://cached.com/1', { fullContent: 'FULL CACHED '.repeat(10), author: null, publishedAt: null, contentHash: null, extractedAt: null }],
      ]),
    );
    mockReadPages.mockResolvedValue(
      new Map([['https://miss.com/1', page('https://miss.com/1', 'FULL FETCHED '.repeat(10))]]),
    );

    const result = await webSearchAction.execute(
      { type: 'web_search', queries: ['q'] },
      makeConfig('balanced'),
    );

    // Only the miss should have been read
    expect(mockReadPages).toHaveBeenCalledTimes(1);
    const readArg = mockReadPages.mock.calls[0][0] as string[];
    expect(readArg).toEqual(['https://miss.com/1']);

    const chunks = getChunks(result);
    const a = chunks.find((r) => r.metadata.url === 'https://cached.com/1');
    const b = chunks.find((r) => r.metadata.url === 'https://miss.com/1');
    expect(a?.content).toContain('FULL CACHED');
    expect(b?.content).toContain('FULL FETCHED');
  });

  it('falls back to a live read when the cache lookup itself errors (does not crash)', async () => {
    mockSearch.mockResolvedValue({
      results: [{ title: 'X', url: 'https://x.com/1', content: 'snippet' }],
    });
    mockGetStored.mockRejectedValue(new Error('Supabase is down'));
    mockReadPages.mockResolvedValue(new Map([['https://x.com/1', page('https://x.com/1', 'FULL LIVE '.repeat(10))]]));

    const result = await webSearchAction.execute(
      { type: 'web_search', queries: ['q'] },
      makeConfig('balanced'),
    );

    // The action should not throw; it should fall back to a live read.
    expect(mockReadPages).toHaveBeenCalled();
    const readArg = mockReadPages.mock.calls[0][0] as string[];
    expect(readArg).toContain('https://x.com/1');
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
      mockReadPages.mockClear();
      mockGetStored.mockResolvedValue(new Map());
      mockReadPages.mockResolvedValue(new Map());

      await webSearchAction.execute({ type: 'web_search', queries: ['q'] }, makeConfig(mode));

      const readUrls = (mockReadPages.mock.calls[0]?.[0] as string[]) ?? [];
      expect(readUrls.length, `mode=${mode}`).toBeLessThanOrEqual(expected);
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

  it('injects selected passages (not the raw truncated page) for a live-read hit', async () => {
    mockSearch.mockResolvedValue({
      results: [{ title: 'Mali', url: 'https://a.test/1', content: 'snippet' }],
    });
    mockGetStored.mockResolvedValue(new Map());
    const longPage = [
      "Le climat du Sahel est semi-aride et connait deux saisons distinctes. ".repeat(15),
      "Le budget 2026 du Mali s'eleve a 3 200 milliards de FCFA selon la loi de finances votee. ".repeat(8),
    ].join('\n\n');
    mockReadPages.mockResolvedValue(new Map([['https://a.test/1', page('https://a.test/1', longPage)]]));

    const result = await webSearchAction.execute(
      { type: 'web_search', queries: ['budget 2026 Mali FCFA'] },
      makeConfig('balanced'),
    );

    const chunks = getChunks(result);
    const chunk = chunks.find((r) => r.metadata.url === 'https://a.test/1');
    expect(chunk?.content).toContain('Extraits pertinents');
    expect(chunk?.content).toContain('budget 2026');
  });
});
