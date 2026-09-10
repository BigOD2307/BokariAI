/**
 * Hybrid search over the news corpus (C9).
 *
 * The ranking runs inside Postgres (`search_news(...)`, created by
 * scripts/setup-news-corpus.mjs): full-text rank fused with pgvector cosine
 * distance, a 7-day-half-life freshness decay, and a tier lift for
 * agencies / IFCN-JTI-certified outlets. Nothing ships 500 embeddings over
 * the wire — this is the whole reason the corpus is pgvector, not JSONB.
 */
import { sql } from 'drizzle-orm';
import { pgDb } from '@/lib/db/postgres/client';
import { embedOne } from '@/lib/ai/gateway';

export type NewsHit = {
  id: number;
  url: string;
  title: string;
  /** Trimmed body excerpt (the SQL returns the full body; we cap here). */
  body: string;
  publishedAt: Date;
  domain: string;
  sourceName: string;
  tier: number;
  isStateMedia: boolean;
  isCertified: boolean;
  suspendedIn: string[];
  score: number;
};

const DEFAULT_LIMIT = 12;
const MAX_AGE_DAYS_DEFAULT = 90;

/**
 * Search the corpus. `query` drives both halves: a websearch-syntax tsquery
 * and a BGE-M3 query embedding. Either half alone can score (the SQL ORs the
 * match conditions), so an embedding outage degrades to lexical instead of
 * failing the search.
 */
export async function searchNews(
  query: string,
  opts: {
    limit?: number;
    maxAgeDays?: number;
    /** ISO country codes — restrict to outlets editorially close to these. */
    countries?: string[];
    queryEmbedding?: number[];
  } = {},
): Promise<NewsHit[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const limit = Math.min(opts.limit ?? DEFAULT_LIMIT, 30);
  const maxAgeDays = opts.maxAgeDays ?? MAX_AGE_DAYS_DEFAULT;

  let embedding: number[] | null = null;
  try {
    embedding = opts.queryEmbedding ?? (await embedOne(trimmed));
  } catch (err) {
    console.warn('[Bokari news] query embedding failed, lexical-only', {
      error: (err as Error).message,
    });
  }

  const rows = await pgDb.execute<{
    id: number;
    url: string;
    title: string;
    body: string;
    published_at: Date;
    domain: string;
    source_name: string;
    tier: number;
    is_state_media: boolean;
    is_certified: boolean;
    suspended_in: string[] | null;
    score: number;
  }>(sql`
    select * from search_news(
      ${trimmed},
      ${embedding ? sql`${JSON.stringify(embedding)}::vector` : sql`null::vector`},
      ${limit}::int,
      ${maxAgeDays}::int,
      ${opts.countries?.length ? sql`${opts.countries}::text[]` : sql`null::text[]`}
    )
  `);

  const BODY_EXCERPT_CHARS = 1_500;
  return rows.rows.map((r) => ({
    id: r.id,
    url: r.url,
    title: r.title,
    body: (r.body ?? '').slice(0, BODY_EXCERPT_CHARS),
    publishedAt: new Date(r.published_at),
    domain: r.domain,
    sourceName: r.source_name,
    tier: r.tier,
    isStateMedia: r.is_state_media,
    isCertified: r.is_certified,
    suspendedIn: r.suspended_in ?? [],
    score: r.score,
  }));
}
