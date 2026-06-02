/**
 * @module eval/metrics
 * @description Information-retrieval metrics for the citation engine.
 *
 * We support three metrics, all common in the IR literature:
 *
 *   - **NDCG@K** (Normalised Discounted Cumulative Gain at K) — the
 *     gold standard for graded-relevance ranking.  1.0 = perfect, 0.0
 *     = random.  Penalises putting a perfect hit at position 9 vs
 *     position 1.
 *
 *   - **MRR** (Mean Reciprocal Rank) — 1 / rank_of_first_relevant.
 *     1.0 = the first hit is always relevant.  0.5 = the first
 *     relevant is at position 2.
 *
 *   - **Hit rate@K** — fraction of queries with at least one
 *     relevant hit in the top K.  Cheaper to interpret than NDCG,
 *     answers "did we get something useful at all?".
 *
 * All three are pure: same inputs → same outputs, no clock, no
 * randomness.
 *
 * @author Amadou — Dicken AI
 * @version 1.0.0
 */

/** Relevance grades, 0 = irrelevant, higher = more relevant. */
export type Relevance = 0 | 1 | 2 | 3;

/** A scored candidate: position, then grade assigned by the eval set. */
export type RankedItem = {
  /** Position 0-indexed. */
  rank: number;
  /** Relevance of this candidate for the query.  Set by the eval set. */
  relevance: Relevance;
};

const DEFAULT_K = 10;

/**
 * Discounted Cumulative Gain at K.
 *   DCG@K = Σ_{i=0..K-1} (2^rel_i - 1) / log2(i + 2)
 *
 * Using the standard "exponential gain" formulation that gives a
 * strong bonus to highly-relevant items.  This is the variant
 * recommended by Burges et al. (2005) and used by every major IR
 * benchmark.
 */
export function dcg(items: readonly RankedItem[], k: number = DEFAULT_K): number {
  let s = 0;
  const top = Math.min(k, items.length);
  for (let i = 0; i < top; i++) {
    const item = items[i];
    const rel = item.relevance;
    if (rel <= 0) continue;
    const gain = Math.pow(2, rel) - 1;
    const discount = Math.log2(i + 2);
    s += gain / discount;
  }
  return s;
}

/**
 * Ideal DCG at K: the DCG you'd get if you could rank all the
 * relevant items in decreasing relevance order.  This is the
 * denominator for NDCG.
 */
export function idcg(items: readonly RankedItem[], k: number = DEFAULT_K): number {
  // Sort by relevance descending.  The ideal ranking is just
  // "all the relevant items, highest first".
  const sorted = [...items].sort((a, b) => b.relevance - a.relevance);
  return dcg(sorted, k);
}

/**
 * Normalised DCG at K.  Returns 0 if the ideal is 0 (i.e. no
 * relevant items at all in the candidate set — there's nothing to
 * rank for).
 */
export function ndcg(items: readonly RankedItem[], k: number = DEFAULT_K): number {
  const ideal = idcg(items, k);
  if (ideal === 0) return 0;
  return dcg(items, k) / ideal;
}

/**
 * Mean Reciprocal Rank: 1 / (1-indexed position of first relevant).
 * Returns 0 if no item is relevant (rank of first relevant is +∞).
 */
export function mrr(items: readonly RankedItem[]): number {
  for (const item of items) {
    if (item.relevance > 0) {
      return 1 / (item.rank + 1);
    }
  }
  return 0;
}

/**
 * Hit rate at K: 1 if at least one item in the top K has relevance
 * > 0, else 0.  Used to compute the *mean* hit rate across many
 * queries.
 */
export function hitRateAtK(items: readonly RankedItem[], k: number = DEFAULT_K): number {
  const top = Math.min(k, items.length);
  for (let i = 0; i < top; i++) {
    if (items[i].relevance > 0) return 1;
  }
  return 0;
}

/**
 * Aggregate metrics across many queries.  Each query contributes
 * one set of `RankedItem`s, and we average the per-query scores.
 */
export type AggregateMetrics = {
  queries: number;
  ndcgAtK: number;
  mrr: number;
  hitRateAtK: number;
  k: number;
};

export function aggregate(
  perQuery: readonly (readonly RankedItem[])[],
  k: number = DEFAULT_K,
): AggregateMetrics {
  if (perQuery.length === 0) {
    return { queries: 0, ndcgAtK: 0, mrr: 0, hitRateAtK: 0, k };
  }
  let ndcgSum = 0;
  let mrrSum = 0;
  let hitSum = 0;
  for (const items of perQuery) {
    ndcgSum += ndcg(items, k);
    mrrSum += mrr(items);
    hitSum += hitRateAtK(items, k);
  }
  const n = perQuery.length;
  return {
    queries: n,
    ndcgAtK: ndcgSum / n,
    mrr: mrrSum / n,
    hitRateAtK: hitSum / n,
    k,
  };
}
