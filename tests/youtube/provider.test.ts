/**
 * @module tests/youtube/provider
 * @description Unit tests for the YouTube search provider router. Verifies the
 * scrape default, API selection by key, Bright Data selection, the master
 * switch, graceful fallback on a non-OK API response, and the reset hook.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock the search module so the `scrape` path is deterministic and offline.
const scrapeMock = vi.fn(async (_q: string, _opts?: any) => ({
  results: [
    {
      title: 'Scraped video',
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      thumbnail: 'thumb',
      iframe_src: 'iframe',
    },
  ],
  suggestions: [],
}));

vi.mock('@/lib/search', () => ({
  searchSearxng: (q: string, opts?: any) => scrapeMock(q, opts),
}));

describe('youtube/provider routing', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.YOUTUBE_API_KEY;
    delete process.env.YOUTUBE_SEARCH_PROVIDER;
    delete process.env.BOKARI_YOUTUBE_SEARCH_ENABLED;
    delete process.env.BRIGHTDATA_API_KEY;
    delete process.env.BRIGHTDATA_DS_YOUTUBE_VIDEOS;
    scrapeMock.mockClear();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllGlobals();
  });

  it('defaults to the scrape provider (zero-config)', async () => {
    const { getYouTubeProvider, resetYouTubeProviderCache } = await import(
      '@/lib/youtube/provider'
    );
    resetYouTubeProviderCache();
    const provider = getYouTubeProvider();
    expect(provider.kind).toBe('scrape');
    const out = await provider.search('mobile money');
    expect(out.results).toHaveLength(1);
    expect(scrapeMock).toHaveBeenCalled();
    // The scrape adapter uses the internal youtube_scrape engine to avoid
    // recursing through the provider.
    expect(scrapeMock.mock.calls[0][1]).toMatchObject({
      engines: ['youtube_scrape'],
    });
  });

  it('selects the api provider when YOUTUBE_API_KEY is set and maps items', async () => {
    process.env.YOUTUBE_API_KEY = 'yt_test';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          items: [
            {
              id: { videoId: 'abcdEFGH123' },
              snippet: { title: 'Titre', description: 'desc' },
            },
          ],
        }),
      })) as any,
    );
    const { getYouTubeProvider, resetYouTubeProviderCache } = await import(
      '@/lib/youtube/provider'
    );
    resetYouTubeProviderCache();
    const provider = getYouTubeProvider();
    expect(provider.kind).toBe('api');
    const out = await provider.search('q');
    expect(out.results).toHaveLength(1);
    expect(out.results[0].url).toBe(
      'https://www.youtube.com/watch?v=abcdEFGH123',
    );
    expect(out.results[0].iframe_src).toContain('/embed/abcdEFGH123');
    // API path should not touch the scrape fallback on success.
    expect(scrapeMock).not.toHaveBeenCalled();
  });

  it('api provider falls back to scrape on a non-OK response (quota/403)', async () => {
    process.env.YOUTUBE_API_KEY = 'yt_test';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 403, json: async () => ({}) })) as any,
    );
    const { getYouTubeProvider, resetYouTubeProviderCache } = await import(
      '@/lib/youtube/provider'
    );
    resetYouTubeProviderCache();
    const provider = getYouTubeProvider();
    const out = await provider.search('q');
    expect(scrapeMock).toHaveBeenCalled();
    expect(out.results).toHaveLength(1); // from the scrape mock
  });

  it('selects brightdata only when key + dataset are present', async () => {
    process.env.YOUTUBE_SEARCH_PROVIDER = 'brightdata';
    process.env.BRIGHTDATA_API_KEY = 'bd_test';
    process.env.BRIGHTDATA_DS_YOUTUBE_VIDEOS = 'gd_yt';
    const { getYouTubeProvider, resetYouTubeProviderCache } = await import(
      '@/lib/youtube/provider'
    );
    resetYouTubeProviderCache();
    expect(getYouTubeProvider().kind).toBe('brightdata');
  });

  it('brightdata without config degrades to scrape', async () => {
    process.env.YOUTUBE_SEARCH_PROVIDER = 'brightdata';
    // No key/dataset.
    const { getYouTubeProvider, resetYouTubeProviderCache } = await import(
      '@/lib/youtube/provider'
    );
    resetYouTubeProviderCache();
    expect(getYouTubeProvider().kind).toBe('scrape');
  });

  it('master switch off forces scrape even with an API key', async () => {
    process.env.BOKARI_YOUTUBE_SEARCH_ENABLED = 'false';
    process.env.YOUTUBE_API_KEY = 'yt_test';
    const { getYouTubeProvider, resetYouTubeProviderCache, isYouTubeSearchEnabled } =
      await import('@/lib/youtube/provider');
    resetYouTubeProviderCache();
    expect(isYouTubeSearchEnabled()).toBe(false);
    expect(getYouTubeProvider().kind).toBe('scrape');
  });

  it('memoizes and resetYouTubeProviderCache clears it', async () => {
    const { getYouTubeProvider, resetYouTubeProviderCache } = await import(
      '@/lib/youtube/provider'
    );
    resetYouTubeProviderCache();
    const first = getYouTubeProvider();
    expect(getYouTubeProvider()).toBe(first); // memoized
    process.env.YOUTUBE_API_KEY = 'yt_test';
    expect(getYouTubeProvider().kind).toBe('scrape'); // still cached
    resetYouTubeProviderCache();
    expect(getYouTubeProvider().kind).toBe('api');
  });
});
