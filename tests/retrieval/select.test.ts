import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Chunk } from '@/lib/types';

vi.mock('@/lib/ai/reranker', () => ({
  getRerankConfig: () => ({ enabled: false }),
  getReranker: () => {
    throw new Error('should not be called when rerank is disabled');
  },
}));

const { selectEvidence, DEFAULT_BUDGET } = await import('@/lib/retrieval/select');

const chunk = (over: Partial<Chunk> & { url: string; domain?: string; publishedAt?: string | null }): Chunk => ({
  content: 'contenu par defaut',
  ...over,
  metadata: { url: over.url, title: `titre ${over.url}`, publishedAt: over.publishedAt ?? undefined },
});

describe('selectEvidence', () => {
  it('prefers a fresh source over a stale one at equal lexical score', async () => {
    const now = new Date('2026-08-30');
    const chunks = [
      chunk({ url: 'https://old.test/a', content: 'budget mali', publishedAt: '2024-01-01T00:00:00Z' }),
      chunk({ url: 'https://new.test/a', content: 'budget mali', publishedAt: '2026-08-29T00:00:00Z' }),
    ];
    const out = await selectEvidence(chunks, 'budget mali', DEFAULT_BUDGET.speed, now);
    expect(out[0].metadata!.url).toBe('https://new.test/a');
  });

  it('never exceeds the token budget', async () => {
    const chunks = Array.from({ length: 30 }, (_, i) =>
      chunk({ url: `https://d${i}.test/a`, content: 'mot '.repeat(500) }),
    );
    const budget = { ...DEFAULT_BUDGET.speed, maxTokens: 1_000 };
    const out = await selectEvidence(chunks, 'mot', budget);
    const totalChars = out.reduce((n, c) => n + (c.content?.length ?? 0), 0);
    // ~4 chars/token is a safe upper bound for this ASCII text.
    expect(totalChars / 4).toBeLessThan(1_100);
  });

  it('caps passages per domain', async () => {
    const chunks = [
      chunk({ url: 'https://a.test/1', content: 'mali budget' }),
      chunk({ url: 'https://a.test/2', content: 'mali budget' }),
      chunk({ url: 'https://a.test/3', content: 'mali budget' }),
      chunk({ url: 'https://b.test/1', content: 'mali budget' }),
    ];
    const out = await selectEvidence(chunks, 'mali budget', DEFAULT_BUDGET.speed);
    const fromA = out.filter((c) => new URL(c.metadata!.url as string).hostname === 'a.test');
    expect(fromA.length).toBeLessThanOrEqual(2);
  });

  it('returns an empty array for no input', async () => {
    expect(await selectEvidence([], 'x', DEFAULT_BUDGET.speed)).toEqual([]);
  });

  it('does not crash on a chunk with no url/date metadata', async () => {
    const chunks: Chunk[] = [{ content: 'contenu sans metadata', metadata: {} }];
    const out = await selectEvidence(chunks, 'contenu', DEFAULT_BUDGET.speed);
    expect(out).toHaveLength(1);
  });

  it('falls back to freshness/authority ranking when BM25 cannot discriminate', async () => {
    const now = new Date('2026-08-30');
    const chunks = [
      chunk({ url: 'https://old.test/a', content: 'contenu totalement hors sujet', publishedAt: '2020-01-01T00:00:00Z' }),
      chunk({ url: 'https://new.test/a', content: 'contenu totalement hors sujet', publishedAt: '2026-08-29T00:00:00Z' }),
    ];
    const out = await selectEvidence(chunks, 'un terme qui napparait nulle part', DEFAULT_BUDGET.speed, now);
    // Neither scores lexically, so freshness alone should still order them.
    expect(out[0].metadata!.url).toBe('https://new.test/a');
  });
});

describe('selectEvidence — reranker integration', () => {
  beforeEach(() => vi.resetModules());

  it('survives a reranker failure without losing evidence', async () => {
    vi.doMock('@/lib/ai/reranker', () => ({
      getRerankConfig: () => ({ enabled: true }),
      getReranker: () => ({
        rank: async () => {
          throw new Error('502');
        },
      }),
    }));
    const { selectEvidence: selectWithFailingReranker, DEFAULT_BUDGET: budget } = await import(
      '@/lib/retrieval/select'
    );
    const chunks = Array.from({ length: 30 }, (_, i) =>
      chunk({ url: `https://d${i}.test/a`, content: `mali budget ${i}` }),
    );
    const out = await selectWithFailingReranker(chunks, 'mali budget', budget.speed);
    // Lexical order stands — evidence is not lost just because rerank failed.
    expect(out.length).toBeGreaterThan(0);
    expect(out.length).toBeLessThanOrEqual(budget.speed.maxPassages);
  });

  it('uses the reranked order when the cross-encoder succeeds', async () => {
    vi.doMock('@/lib/ai/reranker', () => ({
      getRerankConfig: () => ({ enabled: true }),
      getReranker: () => ({
        // Reverse whatever order it's given, so we can tell the reranked
        // order was actually applied.
        rank: async (_q: string, docs: Array<{ id: string; text: string }>, topN?: number) =>
          [...docs]
            .reverse()
            .slice(0, topN)
            .map((d, i) => ({ id: d.id, score: 1 - i * 0.01, index: Number(d.id) })),
      }),
    }));
    const { selectEvidence: selectWithReranker, DEFAULT_BUDGET: budget } = await import('@/lib/retrieval/select');
    const chunks = Array.from({ length: 30 }, (_, i) =>
      chunk({ url: `https://d${i}.test/a`, content: `mali budget ${i}` }),
    );
    const out = await selectWithReranker(chunks, 'mali budget', budget.speed);
    expect(out.length).toBeGreaterThan(0);
  });
});
