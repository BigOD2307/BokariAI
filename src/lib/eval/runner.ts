/**
 * @module eval/runner
 * @description Side-by-side comparison of BM25-only vs hybrid
 * (BM25 + cosine) vs cross-encoder-reranked ranking, on a fixed
 * eval dataset.
 *
 * The runner is pure: given articles + queries + a query-embedding
 * function, it produces a metrics report.  No clock, no network.
 * The embedding function is injected so tests can use deterministic
 * vectors.
 *
 * Workflow per query:
 *   1. Rank with BM25 only (cosine multiplier = 1.0)
 *   2. Embed the query, rank with hybrid (BM25 + cosine at the
 *      configured `cosineWeight`)
 *   3. If `rerank` is set, run the cross-encoder over the top-50
 *      hybrid candidates and return the top-K in cross-encoder order.
 *   4. Convert each ranking to RankedItem[] using derived relevance.
 *   5. Compute NDCG@K, MRR, hit rate
 *   6. Aggregate across queries
 *
 * @author Amadou — Dicken AI
 * @version 1.2.0
 */

import { rank } from '@/lib/discover/ranker';
import { rerankTopN, type RerankStageOptions } from '@/lib/discover/rerank';
import type { Article, RankOptions } from '@/lib/discover/types';
import { aggregate, ndcg, mrr, hitRateAtK, type RankedItem } from './metrics';
import { AFRICAN_EVAL_QUERIES, deriveRelevance, type EvalQuery } from './dataset';

const K = 10;
const RERANK_CANDIDATE_POOL = 50;

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
  cosineWeight?: number,
  limit: number = K,
): RankOptions {
  return {
    topic: query.topic ?? 'africa',
    intent: 'news',
    queries: [query.query],
    isAfricanContext: true,
    now: NOW,
    limit,
    maxPerDomain: 99, // disable diversity cap for eval (we want raw ranking)
    useCosine,
    queryEmbedding: queryEmbedding,
    ...(cosineWeight !== undefined ? { cosineWeight } : {}),
  };
}

export type EvalReport = {
  bm25Only: { ndcgAtK: number; mrr: number; hitRateAtK: number };
  hybrid: { ndcgAtK: number; mrr: number; hitRateAtK: number };
  /**
   * Cross-encoder rerank metrics.  Null when `options.rerank` is
   * unset.  When set, computed via `rerankTopN` over the top-50
   * hybrid candidates.
   */
  reranked: { ndcgAtK: number; mrr: number; hitRateAtK: number } | null;
  k: number;
  queries: number;
  cosineWeight: number;
  rerankConfig: { topN: number; candidatePool: number; mode: 'live' | 'offline' } | null;
  perQuery: Array<{
    query: string;
    bm25: { ndcg: number; mrr: number; hit: number };
    hybrid: { ndcg: number; mrr: number; hit: number };
    reranked: { ndcg: number; mrr: number; hit: number } | null;
  }>;
};

export type RunEvalOptions = {
  /** K for the top-N cutoff.  Default 10. */
  k?: number;
  /**
   * How much cosine similarity influences the final score.
   * 0.0 = pure BM25, 1.0 = cosine-on-top-of-BM25.  Default 0.3
   * (matches the production ranker default).
   */
  cosineWeight?: number;
  /**
   * Opt-in cross-encoder rerank.  When set, the report includes a
   * `reranked` column.  Default: undefined (rerank not run, report
   * identical to v1.1).
   */
  rerank?: RerankStageOptions;
};

export async function runEval(
  corpus: readonly Article[],
  queries: readonly EvalQuery[],
  embed: EmbedFn,
  options: RunEvalOptions = {},
): Promise<EvalReport> {
  const K_LOCAL = options.k ?? K;
  const cosineWeight = options.cosineWeight ?? 0.3;
  const rerankCfg = options.rerank ?? null;
  const perQueryBm25: RankedItem[][] = [];
  const perQueryHybrid: RankedItem[][] = [];
  const perQueryReranked: RankedItem[][] = [];
  const perQueryReport: EvalReport['perQuery'] = [];

  for (const q of queries) {
    // BM25-only
    const bm25Ranked = rank(corpus, q.query, buildRankOptions(q, null, false, undefined, K_LOCAL));
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

    // Hybrid (BM25 + cosine at the configured weight)
    const hybridRanked = rank(
      corpus,
      q.query,
      buildRankOptions(q, qEmbedding, true, cosineWeight, K_LOCAL),
    );
    const hybridItems = toRankedItems(hybridRanked, q);
    perQueryHybrid.push(hybridItems);

    // Cross-encoder rerank (opt-in)
    let rerankItems: RankedItem[] | null = null;
    if (rerankCfg) {
      try {
        // We pass the *full* corpus to the rerank orchestrator; it
        // will produce the top-K (its own candidatePool is 50 by
        // default).  K_LOCAL is the final cutoff we want the report
        // to use.
        const rerankBaseOptions: RankOptions = buildRankOptions(
          q,
          qEmbedding,
          true,
          cosineWeight,
          rerankCfg.candidatePool ?? RERANK_CANDIDATE_POOL,
        );
        const reranked = await rerankTopN(corpus, q.query, rerankBaseOptions, {
          topN: rerankCfg.topN,
          candidatePool: rerankCfg.candidatePool ?? RERANK_CANDIDATE_POOL,
          mode: rerankCfg.mode,
        });
        const sliced = reranked.slice(0, K_LOCAL);
        rerankItems = toRankedItems(sliced, q);
      } catch (err) {
        console.warn(`[eval] Rerank failed for "${q.query}":`, err);
      }
      perQueryReranked.push(rerankItems ?? []);
    }

    // Per-query metrics
    perQueryReport.push({
      query: q.query,
      bm25: {
        ndcg: ndcg(bm25Items, K_LOCAL),
        mrr: mrr(bm25Items),
        hit: hitRateAtK(bm25Items, K_LOCAL),
      },
      hybrid: {
        ndcg: ndcg(hybridItems, K_LOCAL),
        mrr: mrr(hybridItems),
        hit: hitRateAtK(hybridItems, K_LOCAL),
      },
      reranked: rerankItems
        ? {
            ndcg: ndcg(rerankItems, K_LOCAL),
            mrr: mrr(rerankItems),
            hit: hitRateAtK(rerankItems, K_LOCAL),
          }
        : null,
    });
  }

  const bm25Agg = aggregate(perQueryBm25, K_LOCAL);
  const hybridAgg = aggregate(perQueryHybrid, K_LOCAL);
  const rerankedAgg = rerankCfg ? aggregate(perQueryReranked, K_LOCAL) : null;

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
    reranked: rerankedAgg
      ? {
          ndcgAtK: rerankedAgg.ndcgAtK,
          mrr: rerankedAgg.mrr,
          hitRateAtK: rerankedAgg.hitRateAtK,
        }
      : null,
    k: K_LOCAL,
    queries: queries.length,
    cosineWeight,
    rerankConfig: rerankCfg
      ? {
          topN: rerankCfg.topN,
          candidatePool: rerankCfg.candidatePool ?? RERANK_CANDIDATE_POOL,
          mode: rerankCfg.mode,
        }
      : null,
    perQuery: perQueryReport,
  };
}

/** Default dataset: the 34 African eval queries. */
export const DEFAULT_QUERIES = AFRICAN_EVAL_QUERIES;
