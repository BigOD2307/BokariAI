/**
 * @module eval/runner
 * @description Side-by-side comparison of BM25-only vs hybrid
 * (BM25 + cosine) ranking, on a fixed eval dataset.
 *
 * The runner is pure: given articles + queries + a query-embedding
 * function, it produces a metrics report.  No clock, no network.
 * The embedding function is injected so tests can use deterministic
 * vectors.
 *
 * Workflow per query:
 *   1. Rank with BM25 only (cosine multiplier = 1.0)
 *   2. Embed the query, rank with hybrid (BM25 + cosine)
 *   3. Convert both rankings to RankedItem[] using derived
 *      relevance grades
 *   4. Compute NDCG@K, MRR, hit rate
 *   5. Aggregate across queries
 *
 * @author Amadou — Dicken AI
 * @version 1.0.0
 */

import { rank } from '@/lib/discover/ranker';
import type { Article, RankOptions } from '@/lib/discover/types';
import { aggregate, ndcg, mrr, hitRateAtK, type RankedItem } from './metrics';
import { AFRICAN_EVAL_QUERIES, deriveRelevance, type EvalQuery } from './dataset';

const K = 10;

/** Function that takes a list of queries and returns their embeddings. */
export type EmbedFn = (texts: string[]) => Promise<number[][]>;

const NOW = new Date('2026-06-01T12:00:00Z');

function toRankedItems(
  ranked: readonly Article[],
  query: EvalQuery,
): RankedItem[] {
  return ranked.map((a, i) => ({
    rank: i,
    relevance: deriveRelevance(query, {
      title: a.title,
      fullContent: a.content,
      topic: a.topic,
    }),
  }));
}

function buildRankOptions(
  query: EvalQuery,
  queryEmbedding: number[] | null,
  useCosine: boolean,
): RankOptions {
  return {
    topic: query.topic ?? 'africa',
    intent: 'news',
    queries: [query.query],
    isAfricanContext: true,
    now: NOW,
    limit: K,
    maxPerDomain: 99, // disable diversity cap for eval (we want raw ranking)
    useCosine,
    queryEmbedding: queryEmbedding,
  };
}

export type EvalReport = {
  bm25Only: { ndcgAtK: number; mrr: number; hitRateAtK: number };
  hybrid: { ndcgAtK: number; mrr: number; hitRateAtK: number };
  k: number;
  queries: number;
  perQuery: Array<{
    query: string;
    bm25: { ndcg: number; mrr: number; hit: number };
    hybrid: { ndcg: number; mrr: number; hit: number };
  }>;
};

export async function runEval(
  corpus: readonly Article[],
  queries: readonly EvalQuery[],
  embed: EmbedFn,
): Promise<EvalReport> {
  const perQueryBm25: RankedItem[][] = [];
  const perQueryHybrid: RankedItem[][] = [];
  const perQueryReport: EvalReport['perQuery'] = [];

  for (const q of queries) {
    // BM25-only
    const bm25Ranked = rank(corpus, q.query, buildRankOptions(q, null, false));
    const bm25Items = toRankedItems(bm25Ranked, q);
    perQueryBm25.push(bm25Items);

    // Embed the query
    let qEmbedding: number[] | null = null;
    try {
      const [v] = await embed([q.query]);
      qEmbedding = v ?? null;
    } catch (err) {
      console.warn(`[eval] Embedding failed for "${q.query}":`, err);
    }

    // Hybrid (BM25 + cosine)
    const hybridRanked = rank(corpus, q.query, buildRankOptions(q, qEmbedding, true));
    const hybridItems = toRankedItems(hybridRanked, q);
    perQueryHybrid.push(hybridItems);

    // Per-query metrics
    perQueryReport.push({
      query: q.query,
      bm25: {
        ndcg: computeNdcg(bm25Items),
        mrr: computeMrr(bm25Items),
        hit: computeHit(bm25Items),
      },
      hybrid: {
        ndcg: computeNdcg(hybridItems),
        mrr: computeMrr(hybridItems),
        hit: computeHit(hybridItems),
      },
    });
  }

  const bm25Agg = aggregate(perQueryBm25, K);
  const hybridAgg = aggregate(perQueryHybrid, K);

  return {
    bm25Only: {
      ndcgAtK: bm25Agg.ndcgAtK,
      mrr: bm25Agg.mrr,
      hitRateAtK: bm25Agg.hitRateAtK,
    },
    hybrid: {
      ndcgAtK: hybridAgg.ndcgAtK,
      mrr: hybridAgg.mrr,
      hitRateAtK: hybridAgg.hitRateAtK,
    },
    k: K,
    queries: queries.length,
    perQuery: perQueryReport,
  };
}

function computeNdcg(items: RankedItem[]): number {
  return ndcg(items, K);
}
function computeMrr(items: RankedItem[]): number {
  return mrr(items);
}
function computeHit(items: RankedItem[]): number {
  return hitRateAtK(items, K);
}

/** Default dataset: the 20 African eval queries. */
export const DEFAULT_QUERIES = AFRICAN_EVAL_QUERIES;
