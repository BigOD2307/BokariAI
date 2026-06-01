/**
 * @module discover
 * @description Public API for the Discover ranking pipeline.
 * @author Amadou — Dicken AI
 * @version 1.0.0
 */

export { runDiscoverPipeline, TOPIC_LABELS } from './pipeline';
export { rank } from './ranker';
export { classifyQuery, expandQuery, isAfricanContext, normalizeQuery } from './query';
export { detectLanguage } from './language';
export { tokenize, bm25Score, buildBM25Index } from './bm25';
export { freshnessScore, ageMs } from './freshness';
export { applyDiversityCap } from './diversity';
export { isAfricanDomain, isBlockedDomain, AFRICAN_DOMAINS, BLOCKED_DOMAINS } from './domainLists';
export type {
  Article,
  ScoredArticle,
  ScoreBreakdown,
  Topic,
  Language,
  QueryIntent,
  RankOptions,
  PipelineResult,
  PipelineMeta,
  PipelineOptions,
} from './types';
