/**
 * @module discover/search.test
 * @description Unit tests for the in-memory cosine search.
 * @author Amadou — Dicken AI
 */
import { describe, it, expect } from 'vitest';
import { discoverCosineSearch, type DiscoverCandidate } from '@/lib/discover/search';

const NOW = new Date('2026-06-01T12:00:00Z');
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function makeCandidate(overrides: Partial<DiscoverCandidate> = {}): DiscoverCandidate {
  return {
    id: 'id-' + Math.random().toString(36).slice(2, 8),
    title: 'Untitled',
    url: 'https://example.com/' + Math.random().toString(36).slice(2, 8),
    domain: 'example.com',
    language: 'fr',
    publishedAt: NOW,
    topic: 'africa',
    fullContent: 'Body content here.',
    embedding: [1, 0, 0],
    ...overrides,
  };
}

describe('discoverCosineSearch', () => {
  it('returns [] for empty query embedding', () => {
    const c = makeCandidate();
    expect(discoverCosineSearch([], [c])).toEqual([]);
    expect(discoverCosineSearch(undefined as any, [c])).toEqual([]);
  });

  it('returns [] for empty candidates', () => {
    expect(discoverCosineSearch([1, 0, 0], [])).toEqual([]);
  });

  it('returns [] when no candidate crosses minScore', () => {
    const c = makeCandidate({ embedding: [-1, 0, 0] });
    // query = [1, 0, 0], candidate = [-1, 0, 0] → cos = -1 → score = 0
    expect(discoverCosineSearch([1, 0, 0], [c])).toEqual([]);
  });

  it('returns the most similar candidate first', () => {
    const same = makeCandidate({ title: 'same', embedding: [1, 0, 0] });
    const close = makeCandidate({ title: 'close', embedding: [0.9, 0.1, 0] });
    const medium = makeCandidate({ title: 'medium', embedding: [0.2, 0.98, 0] });
    const out = discoverCosineSearch([1, 0, 0], [medium, same, close]);
    expect(out[0].title).toBe('same');
    expect(out[1].title).toBe('close');
    expect(out[2].title).toBe('medium');
  });

  it('respects the limit option', () => {
    const candidates = Array.from({ length: 10 }, (_, i) =>
      makeCandidate({ embedding: [Math.cos(i), Math.sin(i), 0] }),
    );
    const out = discoverCosineSearch([1, 0, 0], candidates, { limit: 3 });
    expect(out).toHaveLength(3);
  });

  it('respects the minScore option', () => {
    const high = makeCandidate({ embedding: [1, 0, 0] });
    const low = makeCandidate({ embedding: [0.5, 0.5, 0] }); // cos = 0.707, score = 0.85
    const veryLow = makeCandidate({ embedding: [0.1, 0.99, 0] }); // cos ≈ 0.1, score ≈ 0.55
    const out = discoverCosineSearch([1, 0, 0], [high, low, veryLow], { minScore: 0.8 });
    expect(out.map((c) => c.title).sort()).toEqual(['Untitled', 'Untitled']);
    expect(out.every((c) => c.score >= 0.8)).toBe(true);
  });

  it('filters by topic when provided', () => {
    const africa = makeCandidate({ topic: 'africa', embedding: [1, 0, 0] });
    const tech = makeCandidate({ topic: 'tech', embedding: [1, 0, 0] });
    const out = discoverCosineSearch([1, 0, 0], [africa, tech], { topic: 'africa' });
    expect(out).toHaveLength(1);
    expect(out[0].topic).toBe('africa');
  });

  it('topic filter is case-insensitive', () => {
    const c = makeCandidate({ topic: 'Tech', embedding: [1, 0, 0] });
    const out = discoverCosineSearch([1, 0, 0], [c], { topic: 'tech' });
    expect(out).toHaveLength(1);
  });

  it('tie-breaks by publishedAt (most recent first)', () => {
    const old = makeCandidate({
      title: 'old',
      publishedAt: new Date(NOW.getTime() - 5 * ONE_DAY_MS),
      embedding: [1, 0, 0],
    });
    const recent = makeCandidate({
      title: 'recent',
      publishedAt: new Date(NOW.getTime() - 1 * ONE_DAY_MS),
      embedding: [1, 0, 0],
    });
    // Force identical scores by giving them the same embedding
    const out = discoverCosineSearch([1, 0, 0], [old, recent]);
    expect(out[0].title).toBe('recent');
    expect(out[1].title).toBe('old');
  });

  it('null publishedAt sinks to the bottom on tie', () => {
    const nullDate = makeCandidate({ title: 'null', publishedAt: null, embedding: [1, 0, 0] });
    const dated = makeCandidate({ title: 'dated', publishedAt: NOW, embedding: [1, 0, 0] });
    const out = discoverCosineSearch([1, 0, 0], [nullDate, dated]);
    expect(out[0].title).toBe('dated');
    expect(out[1].title).toBe('null');
  });

  it('snippets are truncated at 280 chars + ellipsis', () => {
    const long = 'x'.repeat(2000);
    const c = makeCandidate({ fullContent: long, embedding: [1, 0, 0] });
    const out = discoverCosineSearch([1, 0, 0], [c]);
    // 280 chars of body + 1 char of ellipsis = 281
    expect(out[0].snippet.length).toBeLessThanOrEqual(281);
    expect(out[0].snippet.endsWith('…')).toBe(true);
    // The non-ellipsis portion is exactly 280 chars
    expect(out[0].snippet.slice(0, -1)).toHaveLength(280);
  });

  it('skips candidates with empty embeddings', () => {
    const empty = makeCandidate({ embedding: [] });
    const ok = makeCandidate({ embedding: [1, 0, 0] });
    const out = discoverCosineSearch([1, 0, 0], [empty, ok]);
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe(ok.title);
  });

  it('handles mismatched vector lengths gracefully (cos=0, score=0.5, filtered out by minScore)', () => {
    const wrong = makeCandidate({ embedding: [1, 0, 0, 0] }); // 4 dims
    const ok = makeCandidate({ embedding: [1, 0, 0] });
    const out = discoverCosineSearch([1, 0, 0], [wrong, ok]);
    // The mismatched one is filtered by minScore (0.5 < 0.55)
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe(ok.title);
  });

  it('is deterministic for the same inputs', () => {
    const candidates = Array.from({ length: 20 }, (_, i) =>
      makeCandidate({ embedding: [Math.cos(i * 0.3), Math.sin(i * 0.3), 0] }),
    );
    const a = discoverCosineSearch([1, 0, 0], candidates);
    const b = discoverCosineSearch([1, 0, 0], candidates);
    expect(a.map((c) => c.id)).toEqual(b.map((c) => c.id));
    expect(a.map((c) => c.score)).toEqual(b.map((c) => c.score));
  });
});
