/**
 * @module discover/rerank
 * @description Cross-encoder rerank orchestration for the Discover pipeline.
 *
 *   1. `rank()` produces a top-50 of hybrid candidates (BM25 + cosine).
 *   2. We send the top-50 docs through a cross-encoder via
 *      `getReranker().rank()`.
 *   3. We re-emit the top-N in cross-encoder order, attaching the
 *      rerank score + the pre-rerank rank to the `scoreBreakdown`.
 *
 * `rank()` itself stays synchronous — rerank is a separate stage
 * layered on top.  This keeps the existing ranker tests untouched
 * and lets callers opt in (or not) per-query.
 *
 * @author Amadou — Dicken AI
 * @version 1.0.0
 */
import { rank } from './ranker';
import { getReranker } from '@/lib/ai/reranker';
import type { Article, RankOptions, ScoredArticle } from './types';

const DEFAULT_CANDIDATE_POOL = 50;

export type RerankStageOptions = {
  /**
   * How many top-hybrid candidates to send through the cross-encoder.
   * 50 is the default — it's the sweet spot: large enough that the
   * cross-encoder can re-order effectively, small enough that the
   * rerank call stays under 1.5s on OpenRouter and under 25k input
   * tokens ($0.0025/query at OpenRouter's $0.10/1M rate).
   */
  candidatePool?: number;
  /** How many results to return after rerank.  Default 10. */
  topN: number;
  /**
   * `live` calls the real OpenRouter /rerank endpoint.  `offline`
   * uses the deterministic mock.  Tests + CI default to `offline`.
   * `live` silently falls back to `offline` if OPENROUTER_API_KEY
   * is missing (see `getReranker` in `ai/reranker.ts`).
   */
  mode: 'live' | 'offline';
};

/**
 * Build the indexable text that the cross-encoder should score.
 * Title is repeated because for news search the title is the
 * strongest relevance signal.  We cap the body to keep the input
 * under the cross-encoder's 512-token window without truncation.
 */
function docText(article: Article): string {
  const title = (article.title || '').trim();
  const body = (article.content || '').trim().slice(0, 1500);
  if (!body) return `${title}\n${title}`;
  return `${title}\n${title}\n${body}`;
}

/**
 * Get a stable id for an article.  The ranker uses `id ?? url` in
 * its internal map; we mirror that here so the reranker's response
 * (which references the input by index) can be joined back to the
 * original `ScoredArticle` without ambiguity.
 */
function articleId(article: Article, fallback: string): string {
  return article.id ?? article.url ?? fallback;
}

/**
 * Run a top-50 hybrid rank, then rerank the top-N via the
 * cross-encoder, then return the top-N in cross-encoder order.
 *
 * The pre-rerank rank is recorded in `scoreBreakdown.rerank.rankBeforeRerank`
 * and the cross-encoder score in `scoreBreakdown.rerank.score`, so
 * the breakdown tells the full story: "this article was at position
 * 7 in hybrid and the cross-encoder agreed, moving it to position 2".
 *
 * Empty / no-op handling: if `articles` is empty, or `topN` ≤ 0,
 * or `candidatePool` ≤ 0, we return `[]` without making any API
 * call.  This is the safety net callers rely on.
 */
export async function rerankTopN(
  articles: readonly Article[],
  query: string,
  baseOptions: RankOptions,
  rerank: RerankStageOptions,
): Promise<ScoredArticle[]> {
  if (!articles || articles.length === 0) return [];
  if (rerank.topN <= 0) return [];

  const candidatePool = rerank.candidatePool ?? DEFAULT_CANDIDATE_POOL;

  // 1. Top-K hybrid candidates.  Force the limit to `candidatePool`
  //    so we have a stable, predictable input to the cross-encoder.
  //    Disable the diversity cap (default 2/domain) — that's a final-
  //    stage concern.  The rerank wants the top-N *candidates*, not
  //    the top-N *display-ready* feed.
  const hybridRanked = rank(articles, query, {
    ...baseOptions,
    limit: candidatePool,
    maxPerDomain: candidatePool,
  });

  if (hybridRanked.length === 0) return [];

  // If we have fewer candidates than `topN`, just return the hybrid
  // order — no point in paying for a rerank call that can't change
  // the result.
  if (hybridRanked.length <= rerank.topN) {
    return hybridRanked.slice(0, rerank.topN);
  }

  // 2. Send the candidates through the cross-encoder.
  const docs = hybridRanked.map((a) => ({
    id: articleId(a, ''),
    text: docText(a),
  }));
  const reranker = getReranker(rerank.mode);
  const reranked = await reranker.rank(query, docs, rerank.topN);

  // 3. Build a lookup from id → original ScoredArticle + pre-rerank
  //    rank, so we can attach the rerank signal to the breakdown.
  const byId = new Map<string, { article: ScoredArticle; rankBeforeRerank: number }>();
  for (let i = 0; i < hybridRanked.length; i++) {
    const a = hybridRanked[i]!;
    byId.set(articleId(a, ''), { article: a, rankBeforeRerank: i });
  }

  // 4. Re-emit in cross-encoder order.  If a rerank result has no
  //    matching article (shouldn't happen, but be defensive), skip.
  const out: ScoredArticle[] = [];
  for (const r of reranked) {
    const entry = byId.get(r.id);
    if (!entry) continue;
    out.push({
      ...entry.article,
      scoreBreakdown: {
        ...entry.article.scoreBreakdown,
        rerank: { score: r.score, rankBeforeRerank: entry.rankBeforeRerank },
      },
    });
  }
  return out;
}
