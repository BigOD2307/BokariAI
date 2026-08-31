import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

const assertPublicHttpUrl = vi.fn(async (raw: string) => new URL(raw));
vi.mock('@/lib/net/url-guard', () => ({
  assertPublicHttpUrl: (raw: string) => assertPublicHttpUrl(raw),
}));

const { readPage, readPages } = await import('@/lib/retrieval/read');

const ARTICLE_HTML = `<!doctype html>
<html><head>
<title>Le Mali adopte son budget 2026</title>
<script type="application/ld+json">
{"@type":"NewsArticle","author":{"name":"Awa Traore"},"datePublished":"2026-06-01T09:00:00Z"}
</script>
<meta property="article:published_time" content="2026-06-01T09:00:00Z">
</head>
<body>
<nav><a href="/">Accueil</a><a href="/contact">Contact</a></nav>
<header>Newsletter — abonnez-vous</header>
<article>
<h1>Le Mali adopte son budget 2026</h1>
<p>${'Le budget 2026 du Mali s\'eleve a 3 200 milliards de FCFA selon la loi de finances votee ce lundi par le conseil des ministres. '.repeat(6)}</p>
<p>${'Les depenses prioritaires concernent la securite, l\'education et la sante dans les regions du centre et du nord du pays. '.repeat(6)}</p>
</article>
<aside>A lire aussi: autres articles</aside>
<footer>Copyright 2026</footer>
</body></html>`;

function jsonResponse(body: string, init?: ResponseInit): Response {
  return new Response(body, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' }, ...init });
}

describe('readPage', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    assertPublicHttpUrl.mockImplementation(async (raw: string) => new URL(raw));
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('extracts the article body, title, author and date, dropping nav/header/footer boilerplate', async () => {
    global.fetch = vi.fn(async () => jsonResponse(ARTICLE_HTML)) as unknown as typeof fetch;

    const page = await readPage('https://lefaso.net/article');

    expect(page).not.toBeNull();
    expect(page!.text.length).toBeGreaterThan(500);
    expect(page!.text).toContain('budget 2026 du Mali');
    expect(page!.text).not.toContain('Accueil');
    expect(page!.text).not.toContain('Newsletter');
    expect(page!.text).not.toContain('A lire aussi');
    expect(page!.publishedAt?.toISOString()).toBe('2026-06-01T09:00:00.000Z');
    expect(page!.author).toBe('Awa Traore');
  });

  it('returns null when the SSRF guard refuses the URL', async () => {
    assertPublicHttpUrl.mockRejectedValue(new Error('URL resolves to a non-public address'));
    global.fetch = vi.fn() as unknown as typeof fetch;

    const page = await readPage('http://127.0.0.1:3000/api/config');
    expect(page).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns null on a non-OK response', async () => {
    global.fetch = vi.fn(async () => new Response('', { status: 404 })) as unknown as typeof fetch;
    expect(await readPage('https://x.test/a')).toBeNull();
  });

  it('returns null for a non-HTML content type', async () => {
    global.fetch = vi.fn(
      async () => new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }),
    ) as unknown as typeof fetch;
    expect(await readPage('https://x.test/a')).toBeNull();
  });

  it('returns null when the fetch itself throws (timeout, DNS, etc.)', async () => {
    global.fetch = vi.fn(async () => {
      throw new Error('network error');
    }) as unknown as typeof fetch;
    expect(await readPage('https://x.test/a')).toBeNull();
  });

  it('falls back to plain body text when Readability finds too little content', async () => {
    const thin = `<html><body><p>${'court. '.repeat(60)}</p></body></html>`;
    global.fetch = vi.fn(async () => jsonResponse(thin)) as unknown as typeof fetch;
    const page = await readPage('https://x.test/thin');
    expect(page).not.toBeNull();
    expect(page!.text.length).toBeGreaterThan(200);
  });

  it('returns null when there is no usable text at all', async () => {
    global.fetch = vi.fn(async () => jsonResponse('<html><body></body></html>')) as unknown as typeof fetch;
    expect(await readPage('https://x.test/empty')).toBeNull();
  });
});

describe('readPages', () => {
  beforeEach(() => {
    assertPublicHttpUrl.mockImplementation(async (raw: string) => new URL(raw));
  });

  it('reads multiple URLs and omits failures from the result map', async () => {
    global.fetch = vi.fn(async (input) => {
      const url = String(input);
      if (url.includes('bad')) return new Response('', { status: 500 });
      return jsonResponse(ARTICLE_HTML);
    }) as unknown as typeof fetch;

    const out = await readPages(['https://good1.test/a', 'https://bad.test/b', 'https://good2.test/c']);

    expect(out.size).toBe(2);
    expect(out.has('https://good1.test/a')).toBe(true);
    expect(out.has('https://bad.test/b')).toBe(false);
  });
});
