import { describe, it, expect, vi, afterEach } from 'vitest';
import { extractArticle, extractArticlesInParallel } from '@/lib/discover/contentExtractor';

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

/**
 * Mock fetch with a function that returns a new Response on every call.
 * This avoids "Body has already been read" when fetch is called multiple times
 * with the same mock value.
 */
function mockFetchWith(html: string, status = 200, contentType = 'text/html; charset=utf-8') {
  return vi.fn().mockImplementation(
    async () => new Response(html, { status, headers: { 'content-type': contentType } }),
  );
}

function mockFetchSequence(
  responses: Array<{ html: string; status?: number; contentType?: string }>,
) {
  return vi.fn().mockImplementation(async () => {
    const next = responses.shift();
    if (!next) {
      return new Response('', { status: 599 });
    }
    return new Response(next.html, {
      status: next.status ?? 200,
      headers: { 'content-type': next.contentType ?? 'text/html; charset=utf-8' },
    });
  });
}

describe('extractArticle', () => {
  it('returns full content, metadata, and a content hash for a well-formed article', async () => {
    const html = `
      <!doctype html><html><head>
        <title>Bokari - moteur africain</title>
        <script type="application/ld+json">
        { "@type": "NewsArticle", "author": "Aminata Traoré", "datePublished": "2026-05-20T08:30:00+00:00" }
        </script>
      </head><body>
        <article>
          <h1>Bokari</h1>
          <p>Le moteur de recherche africain pour comprendre l'Afrique et ses langues profondes.</p>
          <p>${'a'.repeat(200)}</p>
        </article>
      </body></html>
    `;
    global.fetch = mockFetchWith(html) as any;

    const result = await extractArticle('https://example.com/article');
    expect(result.success).toBe(true);
    expect(result.url).toBe('https://example.com/article');
    expect(result.fullContent).toContain('Bokari');
    expect(result.fullContent).toContain('moteur de recherche africain');
    expect(result.metadata.author).toBe('Aminata Traoré');
    expect(result.metadata.publishedAt?.toISOString()).toBe('2026-05-20T08:30:00.000Z');
    expect(result.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.error).toBeUndefined();
  });

  it('returns success=false on 404 without throwing', async () => {
    global.fetch = vi
      .fn()
      .mockImplementation(async () => new Response('not found', { status: 404 })) as any;
    const result = await extractArticle('https://example.com/missing');
    expect(result.success).toBe(false);
    expect(result.fullContent).toBeNull();
    expect(result.metadata.author).toBeNull();
    expect(result.contentHash).toBeNull();
    expect(result.error).toBeDefined();
  });

  it('returns success=false on non-HTML content-type', async () => {
    global.fetch = vi.fn().mockImplementation(
      async () =>
        new Response('binary', { status: 200, headers: { 'content-type': 'application/pdf' } }),
    ) as any;
    const result = await extractArticle('https://example.com/file.pdf');
    expect(result.success).toBe(false);
    expect(result.error).toContain('non-html');
  });

  it('returns success=false when content is too short', async () => {
    const html = `<html><body><p>tiny</p></body></html>`;
    global.fetch = mockFetchWith(html) as any;
    const result = await extractArticle('https://example.com');
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('truncates very long content to maxLength', async () => {
    const big = 'a'.repeat(10_000);
    const html = `<html><body><article><p>${big}</p></article></body></html>`;
    global.fetch = mockFetchWith(html) as any;
    const result = await extractArticle('https://example.com', { maxLength: 1000 });
    expect(result.success).toBe(true);
    expect(result.fullContent!.length).toBeLessThanOrEqual(1000);
  });

  it('returns a stable content hash for identical content', async () => {
    const html = `<html><body><article><p>${'Bokari '.repeat(100)}</p></article></body></html>`;
    global.fetch = mockFetchWith(html) as any;
    const r1 = await extractArticle('https://example.com/a');
    const r2 = await extractArticle('https://example.com/b');
    expect(r1.contentHash).toBe(r2.contentHash);
  });

  it('returns different content hashes for different content', async () => {
    const html1 = `<html><body><article><p>${'Bokari '.repeat(100)}</p></article></body></html>`;
    const html2 = `<html><body><article><p>${'Africa '.repeat(100)}</p></article></body></html>`;
    global.fetch = mockFetchSequence([
      { html: html1 },
      { html: html2 },
    ]) as any;
    const r1 = await extractArticle('https://example.com/a');
    const r2 = await extractArticle('https://example.com/b');
    expect(r1.contentHash).not.toBe(r2.contentHash);
  });
});

describe('extractArticlesInParallel', () => {
  it('processes all urls in order even when some fail', async () => {
    const okHtml = `<html><body><article><p>${'Bokari, le moteur de recherche africain qui comprend l\'Afrique et ses langues profondes '.repeat(5)}</p></article></body></html>`;
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('ok')) {
        return new Response(okHtml, { status: 200, headers: { 'content-type': 'text/html' } });
      }
      return new Response('nope', { status: 500 });
    }) as any;

    const urls = [
      'https://ok1.example.com',
      'https://fail.example.com',
      'https://ok2.example.com',
    ];
    const results = await extractArticlesInParallel(urls, { maxConcurrent: 2 });
    expect(results).toHaveLength(3);
    expect(results[0].url).toBe(urls[0]);
    expect(results[0].success).toBe(true);
    expect(results[1].url).toBe(urls[1]);
    expect(results[1].success).toBe(false);
    expect(results[2].url).toBe(urls[2]);
    expect(results[2].success).toBe(true);
  });

  it('caps concurrency to maxConcurrent', async () => {
    let inFlight = 0;
    let peakInFlight = 0;
    const okHtml = `<html><body><article><p>${'Bokari moteur africain, '.repeat(20)}</p></article></body></html>`;
    global.fetch = vi.fn().mockImplementation(async () => {
      inFlight++;
      peakInFlight = Math.max(peakInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 20));
      inFlight--;
      return new Response(okHtml, { status: 200, headers: { 'content-type': 'text/html' } });
    }) as any;

    const urls = Array.from({ length: 10 }, (_, i) => `https://example.com/${i}`);
    await extractArticlesInParallel(urls, { maxConcurrent: 3 });
    expect(peakInFlight).toBeLessThanOrEqual(3);
  });

  it('returns an empty array for an empty input', async () => {
    const results = await extractArticlesInParallel([]);
    expect(results).toEqual([]);
  });
});
