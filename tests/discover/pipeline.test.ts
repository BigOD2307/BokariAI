/**
 * @module discover/pipeline.test
 * @description Tests for the Discover orchestrator.
 *
 * Strategy: stub out `searchNews` so we don't hit the network.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the search module BEFORE importing the pipeline.
vi.mock('@/lib/search', () => ({
  searchNews: vi.fn(),
}));

import { searchNews } from '@/lib/search';
import { runDiscoverPipeline } from '@/lib/discover/pipeline';
import type { SearchResult } from '@/lib/search';

const mockSearchNews = searchNews as unknown as ReturnType<typeof vi.fn>;

const NOW = new Date('2026-06-01T12:00:00Z');

function makeResult(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    title: 'Untitled',
    url: 'https://example.com/' + Math.random().toString(36).slice(2, 8),
    content: 'content',
    ...overrides,
  };
}

beforeEach(() => {
  mockSearchNews.mockReset();
  // Default: return 5 results per call
  mockSearchNews.mockImplementation(async (q: string) => [
    { title: `${q} result 1`, url: `https://rfi.fr/${encodeURIComponent(q)}-1`, content: `${q} content 1` },
    { title: `${q} result 2`, url: `https://cnn.com/${encodeURIComponent(q)}-2`, content: `${q} content 2` },
    { title: `${q} result 3`, url: `https://jeuneafrique.com/${encodeURIComponent(q)}-3`, content: `${q} content 3` },
  ]);
});

describe('runDiscoverPipeline', () => {
  it('returns an empty result when no articles can be fetched', async () => {
    mockSearchNews.mockResolvedValue([]);
    const out = await runDiscoverPipeline('africa', { now: NOW });
    expect(out.articles).toEqual([]);
    expect(out.meta.totalCandidates).toBe(0);
  });

  it('returns ranked articles when search succeeds', async () => {
    const out = await runDiscoverPipeline('africa', { now: NOW });
    expect(out.articles.length).toBeGreaterThan(0);
    expect(out.meta.generatedAt).toBeTruthy();
    expect(out.meta.topic).toBe('africa');
  });

  it('attaches a scoreBreakdown to every returned article', async () => {
    const out = await runDiscoverPipeline('africa', { now: NOW });
    for (const a of out.articles) {
      expect(a.scoreBreakdown).toBeDefined();
      expect(a.scoreBreakdown.final).toBeGreaterThanOrEqual(0);
    }
  });

  it('returns a deterministic order for the same inputs', async () => {
    const a = await runDiscoverPipeline('africa', { now: NOW });
    const b = await runDiscoverPipeline('africa', { now: NOW });
    expect(a.articles.map((x) => x.url)).toEqual(b.articles.map((x) => x.url));
  });

  it('respects the limit option', async () => {
    mockSearchNews.mockImplementation(async (q: string) =>
      Array.from({ length: 20 }, (_, i) => makeResult({
        title: `${q} ${i}`,
        url: `https://d${i % 5}.com/${q}-${i}`,
        content: `${q} content ${i}`,
      })),
    );
    const out = await runDiscoverPipeline('africa', { now: NOW, limit: 5 });
    expect(out.articles.length).toBeLessThanOrEqual(5);
  });

  it('handles search errors gracefully (returns empty, no throw)', async () => {
    mockSearchNews.mockRejectedValue(new Error('Network down'));
    const out = await runDiscoverPipeline('africa', { now: NOW });
    expect(out.articles).toEqual([]);
    expect(out.meta.totalCandidates).toBe(0);
  });

  it('caps results at 2 per domain', async () => {
    // All results from the same domain
    mockSearchNews.mockImplementation(async (q: string) =>
      Array.from({ length: 10 }, (_, i) => makeResult({
        title: `${q} ${i}`,
        url: `https://spam.com/${q}-${i}`,
        content: `${q} ${i}`,
      })),
    );
    const out = await runDiscoverPipeline('africa', { now: NOW });
    const fromSpam = out.articles.filter((a) => a.domain === 'spam.com');
    expect(fromSpam.length).toBeLessThanOrEqual(2);
  });

  it('detects language for each article', async () => {
    mockSearchNews.mockImplementation(async (q: string) => [
      { title: 'Le président du Sénégal', url: 'https://rfi.fr/1', content: 'Le président du Sénégal a visité le Mali aujourd\'hui et a tenu une conférence de presse' },
      { title: 'The president of Kenya', url: 'https://bbc.com/1', content: 'The president of Kenya visited Tanzania this morning and held a press conference' },
    ]);
    const out = await runDiscoverPipeline('africa', { now: NOW });
    const fr = out.articles.find((a) => a.url === 'https://rfi.fr/1');
    const en = out.articles.find((a) => a.url === 'https://bbc.com/1');
    expect(fr?.language).toBe('fr');
    expect(en?.language).toBe('en');
  });

  it('records duration in the meta', async () => {
    const out = await runDiscoverPipeline('africa', { now: NOW });
    expect(out.meta.durationMs).toBeGreaterThanOrEqual(0);
  });
});
