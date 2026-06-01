/**
 * Integration test: refresh-time extraction pipeline.
 *
 * Runs `runDiscoverPipeline` (with mocked search) + `extractArticlesInParallel`
 * and verifies the combined row shape that the refresh route would upsert
 * to Supabase.  We don't hit a real DB — we just assert the data we
 * would write.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/search', () => ({ searchNews: vi.fn() }));

import { searchNews } from '@/lib/search';
import { runDiscoverPipeline } from '@/lib/discover/pipeline';
import { extractArticlesInParallel } from '@/lib/discover/contentExtractor';
import type { SearchResult } from '@/lib/search';
import type { ExtractionResult } from '@/lib/discover/contentExtractor';

const mockSearchNews = searchNews as unknown as ReturnType<typeof vi.fn>;

const NOW = new Date('2026-06-01T12:00:00Z');

const ARTICLES: SearchResult[] = [
  {
    title: 'Bamako : un plan emploi ambitieux présenté par le président',
    url: 'https://www.rfi.fr/fr/afrique/2026/06/01/bamako-emploi-jeunes',
    content: "Le président malien a présenté un plan pour l'emploi des jeunes à Bamako.",
    thumbnail: 'https://www.rfi.fr/img/bamako.jpg',
    author: 'Marie Dupont',
  },
  {
    title: 'Lagos tech startup raises $10M for AI agriculture',
    url: 'https://thecable.ng/lagos-tech-10m-ai',
    content: 'A Lagos-based agritech startup has raised $10 million in Series A funding.',
    thumbnail: 'https://thecable.ng/img/lagos.jpg',
  },
  {
    title: 'Nairobi fintech unveils mobile money product',
    url: 'https://techcrunch.com/2026/nairobi-mobile-money',
    content: 'A Nairobi fintech startup has launched a new mobile money product for East Africa.',
  },
];

beforeEach(() => {
  mockSearchNews.mockReset();
  mockSearchNews.mockImplementation(async () => ARTICLES);
});

afterEach(() => {
  vi.restoreAllMocks();
});

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
});

function htmlWithMetadata(title: string, author: string, date: string) {
  return `<!doctype html><html><head>
    <title>${title}</title>
    <script type="application/ld+json">
    { "@type": "NewsArticle", "author": "${author}", "datePublished": "${date}" }
    </script>
  </head><body>
    <article>
      <h1>${title}</h1>
      <p>${'Bokari est un moteur de recherche africain qui comprend l\'Afrique et ses langues profondes. '.repeat(8)}</p>
    </article>
  </body></html>`;
}

function mockFetchForUrl(url: string) {
  if (url.includes('rfi.fr')) return htmlWithMetadata('Bamako emploi', 'Aminata Traoré', '2026-05-30T08:00:00Z');
  if (url.includes('thecable.ng')) return htmlWithMetadata('Lagos tech 10M', 'Tunde Adewale', '2026-05-28T10:00:00Z');
  if (url.includes('techcrunch.com')) return htmlWithMetadata('Nairobi fintech', 'Sarah Chen', '2026-05-25T14:00:00Z');
  return '<html><body><p>fallback</p></body></html>';
}

describe('Refresh-time extraction pipeline', () => {
  it('extracts full content for every kept article', async () => {
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      return new Response(mockFetchForUrl(url), {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    }) as any;

    const { articles } = await runDiscoverPipeline('africa', { now: NOW });
    expect(articles.length).toBeGreaterThan(0);

    const urls = articles.map((a) => a.url);
    const results: ExtractionResult[] = await extractArticlesInParallel(urls, { maxConcurrent: 5 });
    expect(results.length).toBe(urls.length);

    const ok = results.filter((r) => r.success);
    expect(ok.length).toBe(urls.length);
    for (const r of ok) {
      expect(r.fullContent).toBeTruthy();
      expect(r.contentHash).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it('captures author and publishedAt from HTML metadata', async () => {
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      return new Response(mockFetchForUrl(url), {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    }) as any;

    const { articles } = await runDiscoverPipeline('africa', { now: NOW });
    const results = await extractArticlesInParallel(
      articles.map((a) => a.url),
      { maxConcurrent: 5 },
    );
    const byUrl = new Map(results.map((r) => [r.url, r]));

    const rfi = byUrl.get('https://www.rfi.fr/fr/afrique/2026/06/01/bamako-emploi-jeunes');
    expect(rfi?.metadata.author).toBe('Aminata Traoré');
    expect(rfi?.metadata.publishedAt?.toISOString()).toBe('2026-05-30T08:00:00.000Z');
  });

  it('produces a row shape that the refresh route would upsert', async () => {
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      return new Response(mockFetchForUrl(url), {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    }) as any;

    const { articles } = await runDiscoverPipeline('africa', { now: NOW });
    const results = await extractArticlesInParallel(
      articles.map((a) => a.url),
      { maxConcurrent: 5 },
    );
    const extractedByUrl = new Map(results.map((r) => [r.url, r]));
    const nowIso = new Date().toISOString();

    const rows = articles.map((a) => {
      const ex = extractedByUrl.get(a.url);
      if (!ex?.success) return null;
      return {
        topic: a.topic,
        title: a.title,
        content: a.content,
        url: a.url,
        thumbnail: a.thumbnail,
        domain: a.domain,
        language: a.language,
        author: ex.metadata.author ?? a.author,
        published_at: (ex.metadata.publishedAt ?? a.publishedAt)?.toISOString() ?? null,
        quality_score: a.qualityScore,
        full_content: ex.fullContent,
        extracted_at: nowIso,
        content_hash: ex.contentHash,
      };
    }).filter(Boolean) as Array<Record<string, unknown>>;

    expect(rows.length).toBeGreaterThan(0);
    const sample = rows[0];
    expect(sample).toHaveProperty('full_content');
    expect(sample).toHaveProperty('extracted_at');
    expect(sample).toHaveProperty('content_hash');
    expect(typeof sample.full_content).toBe('string');
    expect((sample.full_content as string).length).toBeGreaterThan(50);
  });

  it('handles one bad URL gracefully and still extracts the others', async () => {
    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      callCount++;
      if (url.includes('rfi.fr')) {
        return new Response('not found', { status: 404 });
      }
      return new Response(mockFetchForUrl(url), {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    }) as any;

    const { articles } = await runDiscoverPipeline('africa', { now: NOW });
    const results = await extractArticlesInParallel(
      articles.map((a) => a.url),
      { maxConcurrent: 5 },
    );

    const rfi = results.find((r) => r.url.includes('rfi.fr'));
    expect(rfi?.success).toBe(false);
    expect(rfi?.error).toBeDefined();

    const others = results.filter((r) => !r.url.includes('rfi.fr'));
    for (const r of others) {
      expect(r.success).toBe(true);
      expect(r.fullContent).toBeTruthy();
    }
    expect(callCount).toBeGreaterThanOrEqual(articles.length);
  });
});
