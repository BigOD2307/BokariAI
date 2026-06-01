/**
 * @module discover/search
 * @description In-memory cosine search over Discover articles.
 *
 * The candidate vectors come from `discover_articles.embedding` (JSONB
 * column populated at refresh time).  The query vector comes from the
 * BGE-M3 embedder via the AI gateway.  We compute cosine in JS — at
 * 500 candidates × 1024 dims, that's ~3ms in V8.  When the corpus
 * exceeds ~5k embedded articles, swap this for pgvector + HNSW.
 *
 * Determinism: same (candidates, queryEmbedding) → same ranking.  The
 * function never reads the clock.
 *
 * @author Amadou — Dicken AI
 * @version 1.0.0
 */

import { cosine, cosine01 } from './cosine';

export type DiscoverCandidate = {
  id: string;
  title: string;
  url: string;
  domain: string;
  language: string;
  publishedAt: Date | null;
  topic: string;
  fullContent: string | null;
  /** Optional snippet to show in the UI; falls back to first 280 chars of fullContent. */
  snippet?: string | null;
  /** Optional thumbnail. */
  thumbnail?: string | null;
  /** Optional author. */
  author?: string | null;
  /** Required: BGE-M3 (or compatible) vector. */
  embedding: number[];
};

export type DiscoverSearchHit = {
  id: string;
  title: string;
  url: string;
  domain: string;
  language: string;
  publishedAt: Date | null;
  topic: string;
  snippet: string;
  thumbnail: string | null;
  author: string | null;
  /** Cosine in [-1, 1].  Always the raw value; consumers map to [0,1] if they want. */
  cosine: number;
  /** Cosine mapped to [0, 1].  Use this for thresholds. */
  score: number;
};

export type DiscoverSearchOptions = {
  /** Max results returned.  Default 5. */
  limit?: number;
  /** Minimum cos01 score to include.  Default 0.55 (just above neutral). */
  minScore?: number;
  /** Optional topic filter — only return articles from this topic. */
  topic?: string;
};

const DEFAULT_LIMIT = 5;
const DEFAULT_MIN_SCORE = 0.55;
const SNIPPET_MAX_CHARS = 280;

function makeSnippet(c: DiscoverCandidate): string {
  if (c.snippet && c.snippet.trim()) return c.snippet.trim();
  if (c.fullContent) {
    const trimmed = c.fullContent.replace(/\s+/g, ' ').trim();
    return trimmed.length > SNIPPET_MAX_CHARS
      ? trimmed.slice(0, SNIPPET_MAX_CHARS).trimEnd() + '…'
      : trimmed;
  }
  return '';
}

/**
 * Rank candidates by cosine similarity to the query embedding.
 *
 * Pure: no I/O, no clock.  Sorting is stable so equal scores keep
 * their input order (which is typically "most recent first" if the
 * caller pre-sorted candidates that way).
 *
 * Returns an empty array if:
 *   - queryEmbedding is empty or invalid
 *   - no candidate matches the minScore threshold
 */
export function discoverCosineSearch(
  queryEmbedding: number[],
  candidates: readonly DiscoverCandidate[],
  options: DiscoverSearchOptions = {},
): DiscoverSearchHit[] {
  if (!Array.isArray(queryEmbedding) || queryEmbedding.length === 0) return [];
  if (!Array.isArray(candidates) || candidates.length === 0) return [];

  const limit = options.limit ?? DEFAULT_LIMIT;
  const minScore = options.minScore ?? DEFAULT_MIN_SCORE;
  const topic = options.topic?.toLowerCase().trim();

  // Single pass: compute cosine, drop below threshold, keep top-N.
  // Top-N via a min-heap would be faster for huge N, but for V1 with
  // a few hundred candidates, a simple sort is plenty.
  const scored: DiscoverSearchHit[] = [];
  for (const c of candidates) {
    if (!c.embedding || c.embedding.length === 0) continue;
    if (topic && c.topic.toLowerCase() !== topic) continue;

    const cos = cosine(queryEmbedding, c.embedding);
    const score = cosine01(cos);
    if (score < minScore) continue;

    scored.push({
      id: c.id,
      title: c.title,
      url: c.url,
      domain: c.domain,
      language: c.language,
      publishedAt: c.publishedAt,
      topic: c.topic,
      snippet: makeSnippet(c),
      thumbnail: c.thumbnail ?? null,
      author: c.author ?? null,
      cosine: cos,
      score,
    });
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // Tie-break: most recent first.  null dates sink to the bottom.
    const at = a.publishedAt?.getTime() ?? -Infinity;
    const bt = b.publishedAt?.getTime() ?? -Infinity;
    return bt - at;
  });

  return scored.slice(0, limit);
}
