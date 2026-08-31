import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { SerperProvider } from '@/lib/retrieval/providers/serper';

describe('SerperProvider', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.stubEnv('SERPER_API_KEY', 'serper_test_key');
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  it('is unconfigured without an API key', () => {
    vi.stubEnv('SERPER_API_KEY', '');
    expect(new SerperProvider().isConfigured()).toBe(false);
  });

  it('hits the /news endpoint and parses a relative date for news intent', async () => {
    let capturedUrl: string | undefined;
    let capturedBody: any;
    global.fetch = vi.fn(async (input, init) => {
      capturedUrl = String(input);
      capturedBody = JSON.parse(init!.body as string);
      return new Response(
        JSON.stringify({
          news: [{ title: 'Actu Mali', link: 'https://lefaso.net/a', snippet: 's', date: '2 hours ago' }],
        }),
      );
    }) as unknown as typeof fetch;

    const docs = await new SerperProvider().search('mali', {
      intent: 'news',
      language: 'fr',
      country: 'ML',
      maxAgeDays: 7,
      limit: 10,
    });

    expect(capturedUrl).toBe('https://google.serper.dev/news');
    expect(capturedBody).toMatchObject({ q: 'mali', hl: 'fr', gl: 'ml', tbs: 'qdr:w' });
    expect(docs).toHaveLength(1);
    expect(docs[0].publishedAt).toBeInstanceOf(Date);
    expect(docs[0].domain).toBe('lefaso.net');
  });

  it('hits the /search endpoint for general intent', async () => {
    let capturedUrl: string | undefined;
    global.fetch = vi.fn(async (input) => {
      capturedUrl = String(input);
      return new Response(JSON.stringify({ organic: [] }));
    }) as unknown as typeof fetch;

    await new SerperProvider().search('mali', { intent: 'general', language: 'fr', limit: 10 });
    expect(capturedUrl).toBe('https://google.serper.dev/search');
  });

  it('throws on a non-OK response', async () => {
    global.fetch = vi.fn(async () => new Response('', { status: 401 })) as unknown as typeof fetch;
    await expect(
      new SerperProvider().search('x', { intent: 'general', language: 'fr', limit: 5 }),
    ).rejects.toThrow('serper 401');
  });

  it('drops items with no link or no title', async () => {
    global.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ organic: [{ title: 'no link' }, { link: 'https://x.test/a', title: 'ok' }] })),
    ) as unknown as typeof fetch;

    const docs = await new SerperProvider().search('x', { intent: 'general', language: 'fr', limit: 5 });
    expect(docs).toHaveLength(1);
  });
});
