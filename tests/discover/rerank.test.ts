/**
 * @module discover/rerank.test
 * @description Unit tests for the cross-encoder rerank orchestrator.
 *   Uses the OfflineReranker (deterministic) so the tests are
 *   hermetic.  The live OpenRouterReranker is tested in
 *   `tests/ai/reranker.test.ts`.
 * @author Amadou — Dicken AI
 */
import { describe, it, expect } from 'vitest';
import { rerankTopN } from '@/lib/discover/rerank';
import type { Article, RankOptions } from '@/lib/discover/types';

const NOW = new Date('2026-06-01T12:00:00Z');

function makeArticle(overrides: Partial<Article> = {}): Article {
  return {
    id: overrides.id ?? 'a-' + Math.random().toString(36).slice(2, 8),
    topic: 'africa',
    title: 'Untitled',
    content: 'content',
    url: overrides.url ?? 'https://example.com/' + Math.random().toString(36).slice(2, 8),
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

function buildCorpus(size: number, opts: { relevantIds?: string[]; query: string }): Article[] {
  const out: Article[] = [];
  for (let i = 0; i < size; i++) {
    if (opts.relevantIds && i < opts.relevantIds.length) {
      out.push(
        makeArticle({
          id: opts.relevantIds[i],
          title: `${opts.query} ${i}`,
          content: `${opts.query} ${i}`,
          qualityScore: 0.9,
        }),
      );
    } else {
      out.push(
        makeArticle({
          id: `n-${i}`,
          title: `Random ${i}`,
          content: `Random content ${i}`,
          qualityScore: 0.3,
        }),
      );
    }
  }
  return out;
}

const baseOptions: RankOptions = {
  topic: 'africa',
  intent: 'news',
  queries: ['afrique actualites'],
  isAfricanContext: true,
  now: NOW,
};

describe('rerankTopN (offline mode)', () => {
  it('returns empty array on empty input', async () => {
    const out = await rerankTopN([], 'anything', baseOptions, { topN: 10, mode: 'offline' });
    expect(out).toEqual([]);
  });

  it('returns empty array when topN <= 0', async () => {
    const a = makeArticle({ title: 'foo' });
    const out = await rerankTopN([a], 'foo', baseOptions, { topN: 0, mode: 'offline' });
    expect(out).toEqual([]);
  });

  it('returns the hybrid top-N unchanged when there are fewer candidates than topN', async () => {
    const a = makeArticle({ id: 'a1', title: 'Mali Bamako president' });
    const b = makeArticle({ id: 'a2', title: 'Mali Bamako election' });
    const c = makeArticle({ id: 'a3', title: 'Mali Bamako news' });
    const out = await rerankTopN([a, b, c], 'Mali Bamako president', baseOptions, {
      topN: 10,
      mode: 'offline',
    });
    expect(out).toHaveLength(3);
    expect(out[0]?.id).toBe('a1');
  });

  it('reranks the top-50 and returns the top-N in cross-encoder order', async () => {
    const relevant = ['rel-0', 'rel-1', 'rel-2', 'rel-3', 'rel-4'];
    const articles = buildCorpus(60, { relevantIds: relevant, query: 'Mali Bamako president' });
    const out = await rerankTopN(articles, 'Mali Bamako president', baseOptions, {
      topN: 5,
      mode: 'offline',
    });
    expect(out).toHaveLength(5);
    for (const a of out) {
      expect(a.id).toMatch(/^rel-/);
    }
  });

  it('attaches a `rerank` field to every scoreBreakdown', async () => {
    const relevant = ['rel-0', 'rel-1', 'rel-2', 'rel-3', 'rel-4'];
    const articles = buildCorpus(60, { relevantIds: relevant, query: 'Mali president' });
    const out = await rerankTopN(articles, 'Mali president', baseOptions, {
      topN: 5,
      mode: 'offline',
    });
    for (const a of out) {
      expect(a.scoreBreakdown.rerank).toBeDefined();
      expect(a.scoreBreakdown.rerank?.score).toBeGreaterThanOrEqual(0);
      expect(a.scoreBreakdown.rerank?.rankBeforeRerank).toBeGreaterThanOrEqual(0);
    }
  });

  it('records the pre-rerank rank in rankBeforeRerank', async () => {
    const articles: Article[] = [];
    for (let i = 0; i < 60; i++) {
      articles.push(
        makeArticle({
          id: `n-${i}`,
          title: 'Random ' + i,
          content: 'noisy content ' + i,
          qualityScore: i / 60,
        }),
      );
    }
    // Insert 5 query-relevant articles at the END (low hybrid rank).
    for (let i = 0; i < 5; i++) {
      articles.push(
        makeArticle({
          id: `rel-${i}`,
          title: 'Mali Bamako president ' + i,
          content: 'Mali Bamako president ' + i,
          qualityScore: 0.5,
        }),
      );
    }
    const out = await rerankTopN(articles, 'Mali Bamako president', baseOptions, {
      topN: 5,
      mode: 'offline',
    });
    for (const a of out) {
      expect(a.id).toMatch(/^rel-/);
      expect(a.scoreBreakdown.rerank?.rankBeforeRerank).toBeGreaterThanOrEqual(0);
    }
  });

  it('is deterministic for the same input', async () => {
    const articles = buildCorpus(60, { query: 'article 1' });
    const out1 = await rerankTopN(articles, 'article 1', baseOptions, { topN: 5, mode: 'offline' });
    const out2 = await rerankTopN(articles, 'article 1', baseOptions, { topN: 5, mode: 'offline' });
    expect(out1.map((a) => a.id)).toEqual(out2.map((a) => a.id));
  });

  it('respects the candidatePool size', async () => {
    const articles = buildCorpus(100, { query: 'Mali Bamako president' });
    const out = await rerankTopN(articles, 'Mali Bamako president', baseOptions, {
      topN: 5,
      candidatePool: 10,
      mode: 'offline',
    });
    for (const a of out) {
      expect(a.scoreBreakdown.rerank?.rankBeforeRerank).toBeLessThan(10);
    }
  });

  it('returns ScoredArticle[] with all required fields', async () => {
    const articles = buildCorpus(60, { query: 'Mali Bamako president' });
    const out = await rerankTopN(articles, 'Mali Bamako president', baseOptions, {
      topN: 3,
      mode: 'offline',
    });
    for (const a of out) {
      expect(a.scoreBreakdown).toBeDefined();
      expect(a.scoreBreakdown.bm25).toBeGreaterThanOrEqual(0);
      expect(a.scoreBreakdown.freshness).toBeGreaterThan(0);
      expect(a.scoreBreakdown.cosine).toBeGreaterThanOrEqual(0);
    }
  });
});
