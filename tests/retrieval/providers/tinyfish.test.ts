import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { TinyFishProvider } from '@/lib/retrieval/providers/tinyfish';

describe('TinyFishProvider', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.stubEnv('TINYFISH_API_KEY', 'tf_test_key');
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  it('is unconfigured without an API key', () => {
    vi.stubEnv('TINYFISH_API_KEY', '');
    expect(new TinyFishProvider().isConfigured()).toBe(false);
  });

  it('is configured with an API key', () => {
    expect(new TinyFishProvider().isConfigured()).toBe(true);
  });

  it('maps results and sends the X-API-Key header', async () => {
    let capturedUrl: string | undefined;
    let capturedHeaders: HeadersInit | undefined;
    global.fetch = vi.fn(async (input, init) => {
      capturedUrl = String(input);
      capturedHeaders = init?.headers;
      return new Response(
        JSON.stringify({
          results: [
            { position: 0, title: 'Mali news', url: 'https://lefaso.net/a', snippet: 'un extrait' },
          ],
        }),
      );
    }) as unknown as typeof fetch;

    const docs = await new TinyFishProvider().search('actualite mali', {
      intent: 'general',
      language: 'fr',
      limit: 10,
    });

    expect(docs).toHaveLength(1);
    expect(docs[0]).toMatchObject({
      title: 'Mali news',
      url: 'https://lefaso.net/a',
      domain: 'lefaso.net',
      publishedAt: null,
      provider: 'tinyfish',
      rank: 1,
    });
    expect(capturedUrl).toContain('query=actualite');
    expect((capturedHeaders as Record<string, string>)['X-API-Key']).toBe('tf_test_key');
  });

  it('sets domain_type=research_paper for academic intent', async () => {
    let capturedUrl: string | undefined;
    global.fetch = vi.fn(async (input) => {
      capturedUrl = String(input);
      return new Response(JSON.stringify({ results: [] }));
    }) as unknown as typeof fetch;

    await new TinyFishProvider().search('quantum computing', {
      intent: 'academic',
      language: 'en',
      limit: 5,
    });

    expect(capturedUrl).toContain('domain_type=research_paper');
  });

  it('sets domain_type=news and recency_minutes for news intent with maxAgeDays', async () => {
    let capturedUrl: string | undefined;
    global.fetch = vi.fn(async (input) => {
      capturedUrl = String(input);
      return new Response(JSON.stringify({ results: [] }));
    }) as unknown as typeof fetch;

    await new TinyFishProvider().search('mali actualite', {
      intent: 'news',
      language: 'fr',
      maxAgeDays: 1,
      limit: 5,
    });

    expect(capturedUrl).toContain('domain_type=news');
    expect(capturedUrl).toContain(`recency_minutes=${24 * 60}`);
  });

  it('throws on a non-OK response so the retrieval chain can fall back', async () => {
    global.fetch = vi.fn(async () => new Response('', { status: 500 })) as unknown as typeof fetch;
    await expect(
      new TinyFishProvider().search('x', { intent: 'general', language: 'fr', limit: 5 }),
    ).rejects.toThrow('tinyfish 500');
  });

  it('drops items with no url or no title', async () => {
    global.fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            results: [{ title: 'no url' }, { url: 'https://x.test/a' }, { title: 'ok', url: 'https://x.test/b' }],
          }),
        ),
    ) as unknown as typeof fetch;

    const docs = await new TinyFishProvider().search('x', { intent: 'general', language: 'fr', limit: 5 });
    expect(docs).toHaveLength(1);
    expect(docs[0].url).toBe('https://x.test/b');
  });
});
