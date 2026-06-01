import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchAndExtract, fetchMultipleContent } from '@/lib/utils/extractContent';

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('fetchAndExtract', () => {
  it('returns markdown for a basic html page', async () => {
    const html = `<!doctype html><html><head><title>Hi</title></head>
      <body>
        <nav>navigation</nav>
        <article>
          <h1>Bokari</h1>
          <p>Le moteur de recherche africain pour comprendre l'Afrique.</p>
          <p>${'a'.repeat(200)}</p>
        </article>
        <footer>footer</footer>
      </body></html>`;

    global.fetch = vi.fn().mockResolvedValue(
      new Response(html, {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      }),
    ) as any;

    const md = await fetchAndExtract('https://example.com');
    expect(md).not.toBeNull();
    expect(md).toContain('Bokari');
    expect(md).toContain('moteur de recherche africain');
    expect(md).not.toContain('navigation');
    expect(md).not.toContain('footer');
  });

  it('returns null on non-2xx responses', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(new Response('not found', { status: 404 })) as any;
    const out = await fetchAndExtract('https://example.com');
    expect(out).toBeNull();
  });

  it('returns null for non-html content types', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response('binary', {
        status: 200,
        headers: { 'content-type': 'application/octet-stream' },
      }),
    ) as any;
    const out = await fetchAndExtract('https://example.com');
    expect(out).toBeNull();
  });

  it('truncates very long content to 4000 chars', async () => {
    const big = 'a'.repeat(10_000);
    const html = `<html><body><article><p>${big}</p></article></body></html>`;
    global.fetch = vi.fn().mockResolvedValue(
      new Response(html, {
        status: 200,
        headers: { 'content-type': 'text/html' },
      }),
    ) as any;
    const md = await fetchAndExtract('https://example.com');
    expect(md).not.toBeNull();
    expect(md!.length).toBeLessThanOrEqual(4000);
  });
});

describe('fetchMultipleContent', () => {
  it('returns a map with only successfully fetched urls', async () => {
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('ok')) {
        return new Response(
          '<html><body><article><p>Bokari, le moteur de recherche africain qui comprend l\'Afrique et ses langues.</p></article></body></html>',
          { status: 200, headers: { 'content-type': 'text/html' } },
        );
      }
      return new Response('nope', { status: 500 });
    }) as any;

    const urls = [
      'https://ok.example.com',
      'https://fail.example.com',
      'https://ok.example.com/another',
    ];
    const out = await fetchMultipleContent(urls, 5, 1000);
    expect(out.size).toBe(2);
    expect(out.has('https://ok.example.com')).toBe(true);
    expect(out.has('https://ok.example.com/another')).toBe(true);
    expect(out.has('https://fail.example.com')).toBe(false);
  });
});
