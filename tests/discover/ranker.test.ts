/**
 * @module discover/ranker.test
 * @description Tests for the hybrid ranker with optional cosine blending.
 */
import { describe, it, expect } from 'vitest';
import { rank } from '@/lib/discover/ranker';
import type { Article, RankOptions } from '@/lib/discover/types';
import { cosine, cosine01 } from '@/lib/discover/cosine';

const NOW = new Date('2026-06-01T12:00:00Z');
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function makeArticle(overrides: Partial<Article> = {}): Article {
  return {
    id: 'a-' + Math.random().toString(36).slice(2, 8),
    topic: 'africa',
    title: 'Untitled',
    content: 'content',
    url: 'https://example.com/' + Math.random().toString(36).slice(2, 8),
    thumbnail: null,
    domain: 'example.com',
    language: 'fr',
    publishedAt: NOW,
    author: null,
    qualityScore: 0.5,
    createdAt: NOW,
    ...overrides,
  };
}

const baseOptions: RankOptions = {
  topic: 'africa',
  intent: 'news',
  queries: ['actualites afrique'],
  isAfricanContext: true,
  now: NOW,
};

describe('rank', () => {
  it('returns an empty array for empty input', () => {
    const out = rank([], 'actualites afrique', baseOptions);
    expect(out).toEqual([]);
  });

  it('preserves the order when only one article is given', () => {
    const a = makeArticle({ title: 'A' });
    const out = rank([a], 'A', baseOptions);
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe('A');
  });

  it('ranks a fresh African article above a stale non-African one', () => {
    const fresh = makeArticle({
      title: 'actualites afrique',
      content: 'actualites afrique',
      domain: 'rfi.fr',
      publishedAt: NOW,
    });
    const stale = makeArticle({
      title: 'old news',
      content: 'old news',
      domain: 'cnn.com',
      publishedAt: new Date(NOW.getTime() - 14 * ONE_DAY_MS),
    });
    const out = rank([stale, fresh], 'actualites afrique', baseOptions);
    expect(out[0].url).toBe(fresh.url);
    expect(out[1].url).toBe(stale.url);
  });

  it('attaches a scoreBreakdown to every result', () => {
    const a = makeArticle({ title: 'untitled', content: 'untitled content' });
    const out = rank([a], 'untitled', baseOptions);
    expect(out[0].scoreBreakdown).toBeDefined();
    expect(out[0].scoreBreakdown.final).toBeGreaterThan(0);
    expect(out[0].scoreBreakdown.cosine).toBe(0.5); // neutral
  });

  it('is deterministic (same input → same order)', () => {
    const articles = Array.from({ length: 20 }, (_, i) =>
      makeArticle({
        title: 'afrique ' + i,
        content: 'afrique content ' + i,
        domain: 'd' + (i % 5) + '.com',
        publishedAt: new Date(NOW.getTime() - i * ONE_DAY_MS),
      }),
    );
    const a = rank(articles, 'afrique', baseOptions);
    const b = rank(articles, 'afrique', baseOptions);
    expect(a.map((x) => x.url)).toEqual(b.map((x) => x.url));
  });

  it('applies the African boost when isAfricanContext=true AND domain is African', () => {
    const african = makeArticle({
      title: 'afrique',
      content: 'afrique',
      domain: 'rfi.fr',
      publishedAt: NOW,
    });
    const nonAfrican = makeArticle({
      title: 'afrique',
      content: 'afrique',
      domain: 'cnn.com',
      publishedAt: NOW,
    });
    const out = rank([nonAfrican, african], 'afrique', {
      ...baseOptions,
      isAfricanContext: true,
    });
    expect(out[0].url).toBe(african.url);
  });

  it('does NOT apply the African boost when isAfricanContext=false', () => {
    const african = makeArticle({
      title: 'something',
      content: 'something',
      domain: 'rfi.fr',
      publishedAt: NOW,
    });
    const nonAfrican = makeArticle({
      title: 'something',
      content: 'something',
      domain: 'cnn.com',
      publishedAt: NOW,
    });
    const out = rank([nonAfrican, african], 'something', {
      ...baseOptions,
      isAfricanContext: false,
    });
    expect(out[0].url).toBe(nonAfrican.url);
  });

  it('respects the limit option', () => {
    const articles = Array.from({ length: 10 }, (_, i) =>
      makeArticle({ domain: `d${i}.com` }),
    );
    const out = rank(articles, 'q', { ...baseOptions, limit: 3 });
    expect(out).toHaveLength(3);
  });

  it('does not produce NaN or Infinity in scores', () => {
    const a = makeArticle({
      title: 'a',
      content: 'a',
      publishedAt: null,
    });
    const out = rank([a], 'a', baseOptions);
    expect(Number.isFinite(out[0].scoreBreakdown.final)).toBe(true);
    expect(Number.isNaN(out[0].scoreBreakdown.final)).toBe(false);
  });

  it('weights fresh content higher than stale, same relevance', () => {
    const fresh = makeArticle({
      title: 'mali news',
      content: 'mali news content',
      domain: 'rfi.fr',
      publishedAt: NOW,
    });
    const old = makeArticle({
      title: 'mali news',
      content: 'mali news content',
      domain: 'rfi.fr',
      publishedAt: new Date(NOW.getTime() - 10 * ONE_DAY_MS),
    });
    const out = rank([old, fresh], 'mali news', baseOptions);
    expect(out[0].url).toBe(fresh.url);
  });

  it('lexically relevant content beats irrelevant content (BM25 wins)', () => {
    const relevant = makeArticle({
      title: 'BRVM UEMOA',
      content: 'BRVM UEMOA stock exchange news',
      domain: 'rfi.fr',
      publishedAt: NOW,
    });
    const irrelevant = makeArticle({
      title: 'Tesla earnings',
      content: 'Tesla earnings report Q2 2026',
      domain: 'cnn.com',
      publishedAt: NOW,
    });
    const out = rank([irrelevant, relevant], 'BRVM UEMOA', baseOptions);
    expect(out[0].url).toBe(relevant.url);
  });

  // ---- Cosine blending --------------------------------------------------

  it('cosine=0.5 (neutral) when no query embedding AND no article embedding', () => {
    const a = makeArticle({ title: 'mali' });
    const out = rank([a], 'mali', baseOptions);
    expect(out[0].scoreBreakdown.cosine).toBe(0.5);
  });

  it('cosine is 0.5 when only the article is embedded (no query)', () => {
    const a = makeArticle({ title: 'mali', embedding: [1, 0, 0] });
    const out = rank([a], 'mali', baseOptions);
    expect(out[0].scoreBreakdown.cosine).toBe(0.5);
  });

  it('cosine is 0.5 when only the query is embedded (no article)', () => {
    const a = makeArticle({ title: 'mali' });
    const out = rank([a], 'mali', { ...baseOptions, queryEmbedding: [1, 0, 0] });
    expect(out[0].scoreBreakdown.cosine).toBe(0.5);
  });

  it('cosine computes correctly when both sides are embedded', () => {
    // q = [1, 0, 0], a = [1, 0, 0] → cos=1 → cos01=1
    const a = makeArticle({ title: 'mali', embedding: [1, 0, 0] });
    const out = rank([a], 'mali', { ...baseOptions, queryEmbedding: [1, 0, 0] });
    expect(out[0].scoreBreakdown.cosine).toBe(1);
  });

  it('cosine=0 for opposite vectors, but the floor keeps BM25 winning', () => {
    // q = [1, 0], a = [-1, 0] → cos=-1 → cos01=0 → multiplier=0.7
    // Build two articles: one with same vector as query (cos01=1, mult=1.0),
    // one with opposite vector (cos01=0, mult=0.7).  The match should still
    // win because its multiplier is much higher, and BM25 is also likely
    // higher.
    const match = makeArticle({
      title: 'mali election actualites',
      content: 'mali election actualites',
      domain: 'rfi.fr',
      publishedAt: NOW,
      embedding: [1, 0, 0, 0],
    });
    const opposite = makeArticle({
      title: 'mali election actualites',
      content: 'mali election actualites',
      domain: 'cnn.com',
      publishedAt: NOW,
      embedding: [-1, 0, 0, 0],
    });
    const out = rank([opposite, match], 'mali election', {
      ...baseOptions,
      isAfricanContext: true, // so rfi.fr gets the 1.5x boost too
      queryEmbedding: [1, 0, 0, 0],
    });
    expect(out[0].url).toBe(match.url);
    // And the match's cosine is high, the opposite's is 0
    const byUrl = Object.fromEntries(out.map((a) => [a.url, a.scoreBreakdown]));
    expect(byUrl[match.url].cosine).toBe(1);
    expect(byUrl[opposite.url].cosine).toBe(0);
  });

  it('cosine never produces NaN even with mismatched vector lengths', () => {
    const a = makeArticle({ title: 'mali', embedding: [1, 0, 0] });
    const out = rank([a], 'mali', { ...baseOptions, queryEmbedding: [1, 0] });
    // cosine() returns 0 for mismatched lengths → cos01=0.5
    expect(out[0].scoreBreakdown.cosine).toBe(0.5);
  });

  it('cosine can lift an article but never below 0.7× lexical score', () => {
    // Build two articles with identical BM25 (same title/content),
    // same freshness, same quality.  Differ only in cosine.
    // Article A has perfect cosine (1.0 → factor 1.0).
    // Article B has zero cosine  (0.0 → factor 0.7).
    // A's final score should be > B's.
    const baseA = makeArticle({
      title: 'bamako news',
      content: 'bamako news',
      domain: 'd1.com',
      publishedAt: NOW,
      embedding: [1, 0, 0, 0],
    });
    const baseB = makeArticle({
      title: 'bamako news',
      content: 'bamako news',
      domain: 'd2.com',
      publishedAt: NOW,
      embedding: [-1, 0, 0, 0],
    });
    const out = rank([baseB, baseA], 'bamako', {
      ...baseOptions,
      isAfricanContext: false,
      queryEmbedding: [1, 0, 0, 0],
    });
    const byUrl = Object.fromEntries(out.map((a) => [a.url, a.scoreBreakdown]));
    expect(byUrl[baseA.url].final).toBeGreaterThan(byUrl[baseB.url].final);
    // And B is never crushed below 0.7x of A.
    expect(byUrl[baseB.url].final / byUrl[baseA.url].final).toBeGreaterThanOrEqual(0.7 - 1e-9);
  });
});
