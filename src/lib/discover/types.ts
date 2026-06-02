/**
 * @module discover/types
 * @description Shared types for the Discover ranking pipeline.
 * @author Amadou — Dicken AI
 * @version 1.0.0
 *
 * The Discover pipeline produces `ScoredArticle` instances that carry an
 * `Article` (the upstream shape from search engines / Supabase) plus a
 * `ScoreBreakdown` explaining how the article ended up at its rank.
 *
 * Determinism: every score is a pure function of (article, query, now).
 * The pipeline therefore returns the same ordering for the same inputs,
 * which is what we want — no more `Math.random()` shuffling.
 */

export type Topic =
  | 'africa'
  | 'tech'
  | 'finance'
  | 'art'
  | 'sports'
  | 'politics'
  | 'sante';

export type Language =
  | 'fr'
  | 'en'
  | 'bm'   // Bambara
  | 'wo'   // Wolof
  | 'ha'   // Hausa
  | 'sw'   // Swahili
  | 'other';

/**
 * Intent of a Discover query. Drives the queries we fire and the
 * ranking weights we apply.
 *
 * - `news` — user wants recent events (default for /discover feed)
 * - `research` — user wants deep / evergreen content
 * - `local` — user wants a specific country / city
 * - `mixed` — can't tell, treat as news but lean fresh
 */
export type QueryIntent = 'news' | 'research' | 'local' | 'mixed';

/**
 * Canonical article shape used by the Discover pipeline.
 * Mirrors the Supabase `discover_articles` table after the
 * 20260602 migration.
 */
export type Article = {
  id?: string;
  topic: Topic;
  title: string;
  content: string | null;
  url: string;
  thumbnail: string | null;
  domain: string;
  language: Language;
  publishedAt: Date | null;
  author: string | null;
  qualityScore: number;
  createdAt: Date;
  /** BGE-M3 (or any) embedding of title+content.  Generated at refresh. */
  embedding?: number[] | null;
  /** Model name that produced the embedding — guards against model swaps. */
  embeddingModel?: string | null;
};

/**
 * Per-signal scores so we can debug a bad ranking. The UI does not
 * surface this; it's for the logs and the dev console.
 */
export type ScoreBreakdown = {
  /** Sum of BM25 scores across the expanded query variants. */
  bm25: number;
  /** Exponential decay based on age. 0..1, floor 0.05. */
  freshness: number;
  /** Multiplicative boost (1.0 = no boost, 1.5 = African-source × African-query). */
  africanBoost: number;
  /** Pre-computed quality signal from refresh time. 0..1. */
  quality: number;
  /** Cosine similarity in [0, 1] between the query and the article (if both embedded). */
  cosine: number;
  /** Final combined score used for sorting. */
  final: number;
};

export type ScoredArticle = Article & {
  scoreBreakdown: ScoreBreakdown;
};

export type RankOptions = {
  topic: Topic;
  intent: QueryIntent;
  queries: string[];
  isAfricanContext: boolean;
  now: Date;
  /** Max results per domain in the final feed. Default 2. */
  maxPerDomain?: number;
  /** Total max results returned. Default 30. */
  limit?: number;
  /** Optional query embedding for cosine re-ranking.  When provided AND
   *  the candidate articles carry `embedding` arrays, the ranker blends
   *  cosine similarity into the final score as
   *  `(1 - cosineWeight + cosineWeight * cosine01)`.  Default 0.3. */
  queryEmbedding?: number[] | null;
  /**
   * Disable the cosine blend entirely (multiply by 1.0 instead of
   * `(1 - cosineWeight + cosineWeight * cos01)`).  Used by the
   * eval harness to measure a pure BM25 baseline.  Default true
   * (cosine is on when embeddings exist).
   */
  useCosine?: boolean;
  /**
   * How much cosine similarity influences the final score.
   * Final = BM25 * freshness * africanBoost * (0.5+0.5*quality)
   *              * (1 - cosineWeight + cosineWeight * cosine01)
   *
   * 0.0 = pure BM25, 1.0 = pure cosine-on-top-of-BM25.
   * Default 0.3 (cosine as a tie-breaker).
   */
  cosineWeight?: number;
};

export type PipelineMeta = {
  generatedAt: string;
  totalCandidates: number;
  afterDiversity: number;
  topic: Topic;
  intent: QueryIntent;
  queries: string[];
  durationMs: number;
};

export type PipelineResult = {
  articles: ScoredArticle[];
  meta: PipelineMeta;
};

export type PipelineOptions = {
  mode?: 'normal' | 'preview';
  limit?: number;
  now?: Date;
  maxPerDomain?: number;
  searchFn?: (query: string, language?: string) => Promise<unknown[]>;
};
