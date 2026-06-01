/**
 * @module discover/ranker
 * @description Hybrid ranker: BM25 + freshness + African boost + quality.
 * @author Amadou — Dicken AI
 * @version 1.0.0
 *
 * This is the heart of the Discover pipeline.  Given a query and a set
 * of articles, it produces a deterministic ordering with an attached
 * score breakdown so we can debug bad rankings in the logs.
 *
 * Final score =
 *   BM25 * freshness * africanBoost * (0.5 + 0.5 * quality)
 *
 * Why multiplicative for freshness & boost?  Because we want to *gate*
 * these signals, not just nudge them.  A 7-day-old article with a
 * perfect BM25 should not beat a 1-day-old article with a slightly
 * lower BM25 — that's the user's expectation.  Multiplicative
 * freshness enforces that: an old article can never reach a fresh
 * article's score.
 *
 * Why additive for quality?  Because quality is a small adjustment,
 * not a gate.  A high-quality but stale article can still surface
 * for evergreen topics.
 *
 * No external model.  No random shuffling.  No "AI ranking" black box.
 * Just math, deterministic, debuggable, testable.
 */

import { bm25Score, buildBM25Index, tokenize } from './bm25';
import { freshnessScore, ageMs } from './freshness';
import { applyDiversityCap } from './diversity';
import { isAfricanDomain } from './domainLists';
import type { Article, RankOptions, ScoredArticle, ScoreBreakdown } from './types';

const DEFAULT_LIMIT = 30;
const DEFAULT_MAX_PER_DOMAIN = 2;
const AFRICAN_BOOST_FACTOR = 1.5;
const AFRICAN_BOOST_NEUTRAL = 1.0;

/**
 * Build the indexable text for an article: title (3x) + content + domain.
 * Title is repeated because the user's query is usually closer to the
 * title than to the body for Discover-style news feeds.
 */
function indexableText(article: Article): string {
  return [
    article.title,
    article.title,
    article.title,
    article.content || '',
    article.domain || '',
  ].join(' ');
}

/**
 * Rank a list of articles against a query.
 *
 * Pipeline:
 *   1. Build a BM25 index over all articles (one pass).
 *   2. For each article, compute the BM25 score against the query.
 *   3. Apply multiplicative freshness decay.
 *   4. Apply the multiplicative African-source boost.
 *   5. Additive quality nudge.
 *   6. Sort descending by final score.
 *   7. Apply the diversity cap (max 2 per domain).
 *   8. Slice to `limit`.
 *
 * Each step is O(n) so the whole thing is O(n) — sub-millisecond for
 * 100 articles.
 */
export function rank(
  articles: readonly Article[],
  query: string,
  options: RankOptions,
): ScoredArticle[] {
  if (!articles || articles.length === 0) return [];

  const limit = options.limit ?? DEFAULT_LIMIT;
  const maxPerDomain = options.maxPerDomain ?? DEFAULT_MAX_PER_DOMAIN;
  const now = options.now ?? new Date();

  // 1. Build the BM25 index over the candidate set
  const docs = articles.map((a) => tokenize(indexableText(a)));
  const { idf, avgdl } = buildBM25Index(docs);

  // Score the article against EVERY expanded query variant and take the
  // max — that way, if a synonym variant matches better, it wins.
  // We also include the user's original `query` to make sure we never
  // lose its signal.
  const allQueries = [query, ...(options.queries ?? [])].filter(Boolean);
  const queryVariants = allQueries.map((q) => tokenize(q));

  // 2-5. Score every article
  const scored: ScoredArticle[] = articles.map((article, i) => {
    let bm25 = 0;
    for (const qTokens of queryVariants) {
      const s = bm25Score(qTokens, docs[i], idf, avgdl);
      if (s > bm25) bm25 = s;
    }

    const age = ageMs(article.publishedAt, now);
    // When publishedAt is missing, age is +Infinity and freshness = 0.05
    // (the floor).  That's the right default — we have no signal, so we
    // assume it's stale until proven otherwise.
    const fresh = age === Number.POSITIVE_INFINITY
      ? 0.05
      : freshnessScore(age);

    // African-source × African-query: 1.5x boost.  Otherwise 1.0 (no boost).
    const africanBoost =
      options.isAfricanContext && isAfricanDomain(article.domain)
        ? AFRICAN_BOOST_FACTOR
        : AFRICAN_BOOST_NEUTRAL;

    // Quality is in [0, 1] and acts as a small additive nudge.
    // 0.5 weight on quality means quality ranges from 0.5x to 1.0x the
    // multiplicative product.
    const quality = article.qualityScore ?? 0;
    const qualityMultiplier = 0.5 + 0.5 * Math.max(0, Math.min(1, quality));

    const final = bm25 * fresh * africanBoost * qualityMultiplier;

    const breakdown: ScoreBreakdown = {
      bm25,
      freshness: fresh,
      africanBoost,
      quality,
      final,
    };

    return { ...article, scoreBreakdown: breakdown };
  });

  // 6. Sort by final score (stable)
  scored.sort((a, b) => b.scoreBreakdown.final - a.scoreBreakdown.final);

  // 7. Apply diversity cap
  const diverse = applyDiversityCap(scored, maxPerDomain);

  // 8. Slice to limit
  return diverse.slice(0, limit);
}
