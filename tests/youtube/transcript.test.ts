/**
 * @module tests/youtube/transcript
 * @description Tests for the graded transcript chain: Bright Data wins when
 * configured (first in the chain), InnerTube is next, and a typed unavailable
 * result is returned when every provider fails. Uses an in-memory cache stub so
 * no real SQLite is touched, and stubs global fetch + youtubei.js.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// In-memory SemanticCache stand-in (only the methods the chain calls).
class FakeCache {
  store = new Map<string, any>();
  getByHash(hash: string) {
    return this.store.get(hash) ?? null;
  }
  recordHit() {}
  upsert(input: any) {
    this.store.set(input.queryHash, {
      id: 1,
      response: input.response,
    });
    return 1;
  }
}

// Mock youtubei.js so InnerTube never hits the network. Default: throws (so we
// fall through). Individual tests override via mockResolvedValue.
const innertubeCreate = vi.fn((): Promise<any> => {
  throw new Error('innertube unavailable');
});
vi.mock('youtubei.js', () => ({
  Innertube: { create: () => innertubeCreate() },
}));

describe('agents/media/transcript chain', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.BRIGHTDATA_API_KEY;
    delete process.env.BRIGHTDATA_DS_YOUTUBE_VIDEOS;
    delete process.env.TRANSCRIPT_API_KEY;
    delete process.env.TRANSCRIPT_API_URL;
    delete process.env.ELEVENLABS_API_KEY;
    delete process.env.BOKARI_YOUTUBE_STT_ENABLED;
    innertubeCreate.mockReset();
    innertubeCreate.mockRejectedValue(new Error('innertube unavailable'));
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllGlobals();
  });

  it('returns a typed unavailable result when every provider fails', async () => {
    const { fetchTranscript } = await import('@/lib/agents/media/transcript');
    const cache = new FakeCache() as any;
    const out = await fetchTranscript('dQw4w9WgXcQ', 'fr', { store: cache });
    expect(out.source).toBe('unavailable');
    expect(out.segments).toEqual([]);
    expect(out.videoId).toBe('dQw4w9WgXcQ');
  });

  it('Bright Data wins when configured (first in the chain)', async () => {
    process.env.BRIGHTDATA_API_KEY = 'bd_test';
    process.env.BRIGHTDATA_DS_YOUTUBE_VIDEOS = 'gd_yt';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => [
          {
            transcript: [
              { text: 'Bonjour', start: 0, duration: 2 },
              { text: 'le monde', start: 2, duration: 2 },
            ],
            transcription_language: 'fr',
          },
        ],
      })) as any,
    );
    const { fetchTranscript } = await import('@/lib/agents/media/transcript');
    const cache = new FakeCache() as any;
    const out = await fetchTranscript('dQw4w9WgXcQ', 'fr', { store: cache });
    expect(out.source).toBe('brightdata');
    expect(out.segments).toHaveLength(2);
    expect(out.segments[0].text).toBe('Bonjour');
    // InnerTube must NOT be consulted once Bright Data succeeds.
    expect(innertubeCreate).not.toHaveBeenCalled();
  });

  it('falls through to InnerTube when Bright Data is not configured', async () => {
    innertubeCreate.mockResolvedValue({
      getInfo: async () => ({
        getTranscript: async () => ({
          transcript: {
            content: {
              body: {
                initial_segments: [
                  { snippet: { text: 'hello' }, start_ms: 0, end_ms: 1000 },
                  { snippet: { text: 'world' }, start_ms: 1000, end_ms: 2000 },
                ],
              },
            },
          },
        }),
      }),
    });
    const { fetchTranscript } = await import('@/lib/agents/media/transcript');
    const cache = new FakeCache() as any;
    const out = await fetchTranscript('dQw4w9WgXcQ', 'fr', { store: cache });
    expect(out.source).toBe('innertube');
    expect(out.segments.map((s) => s.text)).toEqual(['hello', 'world']);
    expect(out.segments[1].start).toBe(1); // 1000ms → 1s
  });

  it('caches a successful transcript (no second provider call)', async () => {
    innertubeCreate.mockResolvedValue({
      getInfo: async () => ({
        getTranscript: async () => ({
          transcript: {
            content: {
              body: {
                initial_segments: [
                  { snippet: { text: 'cached' }, start_ms: 0, end_ms: 1000 },
                ],
              },
            },
          },
        }),
      }),
    });
    const { fetchTranscript } = await import('@/lib/agents/media/transcript');
    const cache = new FakeCache() as any;
    const first = await fetchTranscript('vid12345678', 'fr', { store: cache });
    expect(first.source).toBe('innertube');
    innertubeCreate.mockClear();
    const second = await fetchTranscript('vid12345678', 'fr', { store: cache });
    expect(second.source).toBe('innertube');
    expect(innertubeCreate).not.toHaveBeenCalled(); // served from cache
  });
});
