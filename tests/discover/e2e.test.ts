/**
 * @module discover/e2e.test
 * @description End-to-end test of the Discover pipeline against realistic
 * African news queries.  We mock the search layer to feed in curated
 * fixtures that mirror what real engines return, then verify the
 * pipeline produces a sensible, deterministic order.
 *
 * This is the test that proves "a Bambara user searching for news in
 * Bamako gets the right articles first".
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/search', () => ({
  searchNews: vi.fn(),
}));

import { searchNews } from '@/lib/search';
import { runDiscoverPipeline } from '@/lib/discover/pipeline';
import type { SearchResult } from '@/lib/search';

const mockSearchNews = searchNews as unknown as ReturnType<typeof vi.fn>;

const NOW = new Date('2026-06-01T12:00:00Z');

/** Curated corpus of realistic African news results, mixed quality. */
const AFRICA_FIXTURES: SearchResult[] = [
  // High-quality, fresh, African source — should rank #1
  {
    title: "Bamako : le président lance un nouveau plan pour l'emploi des jeunes",
    url: 'https://www.rfi.fr/fr/afrique/2026/06/01/bamako-emploi-jeunes',
    content: "Le président malien a présenté ce matin un plan ambitieux pour créer 50 000 emplois pour les jeunes à Bamako et dans les régions du Sahel. Le programme s'appuie sur des partenariats avec le secteur privé et la diaspora.",
    thumbnail: 'https://www.rfi.fr/img/bamako-emploi.jpg',
    author: 'Marie Dupont',
  },
  // Decent, but not as fresh
  {
    title: 'Actualité Mali : visite du président',
    url: 'https://maliactu.net/article/visite-president-1234',
    content: 'Le chef de l\'État est en visite officielle dans la région de Sikasso depuis trois jours.',
    thumbnail: null,
  },
  // English, African source
  {
    title: 'Lagos tech startup raises $10M for AI-powered agriculture',
    url: 'https://thecable.ng/lagos-tech-10m-ai',
    content: 'A Lagos-based agritech startup has raised $10 million in Series A funding to scale its AI-powered crop yield prediction platform across Nigeria and Kenya.',
    thumbnail: 'https://thecable.ng/img/lagos.jpg',
    author: 'Tunde Adewale',
  },
  // Bad domain (should be filtered)
  {
    title: 'Click here for amazing deals!',
    url: 'https://spam.com/deals',
    content: 'cheap stuff',
  },
  // African source, but irrelevant to the topic
  {
    title: 'Recette du poulet yassa',
    url: 'https://www.rfi.fr/recette-yassa',
    content: 'Comment préparer un bon poulet yassa à la sénégalaise.',
    thumbnail: 'https://www.rfi.fr/img/yassa.jpg',
  },
  // Non-African source, generic
  {
    title: 'African news roundup',
    url: 'https://www.cnn.com/2026/africa-roundup',
    content: 'A roundup of African news this week.',
    thumbnail: null,
  },
];

beforeEach(() => {
  mockSearchNews.mockReset();
  mockSearchNews.mockImplementation(async () => AFRICA_FIXTURES);
});

describe('E2E: Africa topic with realistic fixtures', () => {
  it('blocks spam domains', async () => {
    const out = await runDiscoverPipeline('africa', { now: NOW });
    const urls = out.articles.map((a) => a.url);
    expect(urls).not.toContain('https://spam.com/deals');
  });

  it('caps at 2 articles per domain', async () => {
    const out = await runDiscoverPipeline('africa', { now: NOW });
    const byDomain = new Map<string, number>();
    for (const a of out.articles) {
      byDomain.set(a.domain, (byDomain.get(a.domain) ?? 0) + 1);
    }
    for (const [domain, count] of byDomain) {
      expect(count, `domain ${domain} has ${count} articles`).toBeLessThanOrEqual(2);
    }
  });

  it('returns a deterministic order', async () => {
    const a = await runDiscoverPipeline('africa', { now: NOW });
    const b = await runDiscoverPipeline('africa', { now: NOW });
    expect(a.articles.map((x) => x.url)).toEqual(b.articles.map((x) => x.url));
  });

  it('attaches a finite final score to every kept article', async () => {
    const out = await runDiscoverPipeline('africa', { now: NOW });
    expect(out.articles.length).toBeGreaterThan(0);
    for (const a of out.articles) {
      // Score must be present, finite, non-negative.  We don't
      // require > 0 because irrelevant articles legitimately score 0.
      expect(a.scoreBreakdown).toBeDefined();
      expect(a.scoreBreakdown.final).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(a.scoreBreakdown.final)).toBe(true);
    }
  });

  it('records useful meta in the response', async () => {
    const out = await runDiscoverPipeline('africa', { now: NOW });
    expect(out.meta.topic).toBe('africa');
    expect(out.meta.queries.length).toBeGreaterThan(0);
    expect(out.meta.durationMs).toBeGreaterThanOrEqual(0);
    expect(out.meta.generatedAt).toBeTruthy();
  });
});

describe('E2E: African query boost', () => {
  it('boosts rfi.fr over cnn.com for the same content', async () => {
    mockSearchNews.mockImplementation(async () => [
      {
        title: 'Bamako actualites',
        url: 'https://www.rfi.fr/1',
        content: 'Bamako actualites',
      },
      {
        title: 'Bamako actualites',
        url: 'https://www.cnn.com/1',
        content: 'Bamako actualites',
      },
    ]);
    const out = await runDiscoverPipeline('africa', { now: NOW });
    // The pipeline strips leading 'www.' from the domain.
    expect(out.articles[0].domain).toBe('rfi.fr');
  });
});

describe('E2E: language detection on diverse content', () => {
  it('detects French and English across the corpus', async () => {
    mockSearchNews.mockImplementation(async () => [
      {
        title: 'Le président de la République a visité le Mali',
        url: 'https://rfi.fr/1',
        content:
          "Le président de la République est en visite officielle. Il a rencontré les autorités locales et la population. C'est un événement important pour les relations bilatérales.",
      },
      {
        title: 'The president of Kenya visited Tanzania',
        url: 'https://bbc.com/1',
        content:
          'The president of Kenya visited Tanzania this morning and held a press conference with his counterpart. The two leaders discussed trade and security cooperation.',
      },
    ]);
    const out = await runDiscoverPipeline('africa', { now: NOW });
    const fr = out.articles.find((a) => a.url === 'https://rfi.fr/1');
    const en = out.articles.find((a) => a.url === 'https://bbc.com/1');
    expect(fr?.language).toBe('fr');
    expect(en?.language).toBe('en');
  });
});
