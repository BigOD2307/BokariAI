/**
 * @module discover/pipeline
 * @description Orchestrator: query understanding → search → ranking.
 * @author Amadou — Dicken AI
 * @version 1.0.0
 *
 * Pipeline steps:
 *   1. classifyQuery / expandQuery / isAfricanContext
 *   2. Fire every expanded query against the search engines (parallel)
 *   3. Deduplicate by URL
 *   4. Filter blocked domains
 *   5. Detect language per article
 *   6. rank() with all signals combined
 *   7. Return ScoredArticle[] + meta
 *
 * Search engines are pluggable via the `searchNews` parameter so the
 * pipeline can be tested without network access.  The route handlers
 * inject the real `searchNews` from `@/lib/search`.
 */

import { searchNews as defaultSearchNews } from '@/lib/search';
import { classifyQuery, expandQuery, isAfricanContext } from './query';
import { rank } from './ranker';
import { detectLanguage } from './language';
import { isBlockedDomain } from './domainLists';
import type {
  Article,
  PipelineMeta,
  PipelineResult,
  Topic,
} from './types';
import type { SearchResult } from '@/lib/search';

const DEFAULT_LIMIT = 30;
const DEFAULT_MAX_PER_DOMAIN = 2;

/** Default French labels / icons per topic.  Used for UI breadcrumbs. */
export const TOPIC_LABELS: Record<Topic, { label: string; icon: string }> = {
  africa: { label: 'Afrique', icon: 'globe' },
  tech: { label: 'Tech & IA', icon: 'cpu' },
  finance: { label: 'Economie', icon: 'trending-up' },
  art: { label: 'Culture', icon: 'palette' },
  sports: { label: 'Sports', icon: 'trophy' },
  politics: { label: 'Politique', icon: 'landmark' },
  sante: { label: 'Sante', icon: 'heart-pulse' },
};

/**
 * Extract domain from URL, lowercase, strip "www."
 */
function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

/**
 * Map a SearchResult from the search engine into our Article shape.
 * Missing fields are filled with sensible defaults.
 */
function searchResultToArticle(
  r: SearchResult,
  topic: Topic,
  now: Date,
): Article | null {
  if (!r.title || !r.url) return null;
  const domain = extractDomain(r.url);
  if (!domain) return null;
  if (isBlockedDomain(domain)) return null;

  // Use the snippet or the title as the language-detection input.
  const text = `${r.title}\n${r.content || ''}`;
  const language = detectLanguage(text);

  return {
    id: undefined,
    topic,
    title: r.title.slice(0, 500),
    content: (r.content || '').slice(0, 2000),
    url: r.url,
    thumbnail: r.thumbnail || r.img_src || r.thumbnail_src || null,
    domain,
    language,
    publishedAt: null,    // search engines don't return this reliably
    author: null,
    qualityScore: computeQuality(r),
    createdAt: now,
  };
}

/**
 * Pre-compute a quality signal at index time.
 *   + thumbnail present
 *   + content long enough (>200 chars)
 *   + African source
 * Capped at 1.0.
 */
function computeQuality(r: SearchResult): number {
  let q = 0;
  if (r.thumbnail || r.img_src) q += 0.3;
  if (r.content && r.content.length > 200) q += 0.3;
  if (r.content && r.content.length > 500) q += 0.2;
  if (r.author) q += 0.1;
  if (r.title && r.title.length > 30) q += 0.1;
  return Math.min(1, q);
}

export type PipelineOptions = {
  mode?: 'normal' | 'preview';
  limit?: number;
  now?: Date;
  maxPerDomain?: number;
  /** Override the search function (used in tests). */
  searchFn?: (query: string, language?: string) => Promise<SearchResult[]>;
};

/**
 * Run the full Discover pipeline.
 *
 * @param topic - the topic the user is browsing
 * @param options - tuning knobs
 * @returns ranked articles + metadata
 */
export async function runDiscoverPipeline(
  topic: Topic,
  options: PipelineOptions = {},
): Promise<PipelineResult> {
  const t0 = Date.now();
  const now = options.now ?? new Date();
  const limit = options.limit ?? DEFAULT_LIMIT;
  const maxPerDomain = options.maxPerDomain ?? DEFAULT_MAX_PER_DOMAIN;
  const search = options.searchFn ?? defaultSearchNews;

  // 1. Query understanding — use a synthetic query derived from the topic
  const syntheticQuery = TOPIC_LABELS[topic]?.label ?? topic;
  const intent = classifyQuery(syntheticQuery, topic);
  const queries = expandQuery(syntheticQuery, topic, 'fr');
  const isAfrican = isAfricanContext(syntheticQuery) || topic === 'africa';

  // 2. Fire every query in parallel
  let rawResults: SearchResult[] = [];
  try {
    const all = await Promise.all(
      queries.map((q) => search(q, 'fr').catch(() => [] as SearchResult[])),
    );
    rawResults = all.flat();
  } catch {
    rawResults = [];
  }

  // 3. Deduplicate by URL
  const seen = new Set<string>();
  const unique: SearchResult[] = [];
  for (const r of rawResults) {
    const url = (r.url || '').toLowerCase().trim();
    if (!url) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    unique.push(r);
  }

  // 4-5. Map to Article + filter blocked + detect language
  const candidates: Article[] = [];
  for (const r of unique) {
    const a = searchResultToArticle(r, topic, now);
    if (a) candidates.push(a);
  }

  // 6. Rank
  const ranked = rank(candidates, syntheticQuery, {
    topic,
    intent,
    queries,
    isAfricanContext: isAfrican,
    now,
    limit,
    maxPerDomain,
  });

  const meta: PipelineMeta = {
    generatedAt: now.toISOString(),
    totalCandidates: candidates.length,
    afterDiversity: ranked.length,
    topic,
    intent,
    queries,
    durationMs: Date.now() - t0,
  };

  return { articles: ranked, meta };
}
