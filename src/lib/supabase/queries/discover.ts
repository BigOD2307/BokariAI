/**
 * @module supabase/queries/discover
 * @description Server-side helpers for the Discover table — Phase 4+
 * additions on top of `getStoredContentForUrls` from Phase 2.
 *
 * `getEmbeddedDiscoverCandidates` pulls the most recent articles that
 * have a BGE-M3 embedding, ready to be cosine-scored in JS. We do
 * NOT use this for the ranker (which works on the in-memory
 * candidate set); this is for the search agent and the citation
 * engine.
 *
 * @author Amadou — Dicken AI
 * @version 1.0.0
 */
import { and, desc, eq, gte, isNotNull } from 'drizzle-orm';
import { pgDb, schema } from '@/lib/db/postgres/client';
import type { DiscoverCandidate } from '@/lib/discover/search';

export type GetCandidatesOptions = {
  /** Max rows to return.  Default 500.  Cap to keep payload sane. */
  limit?: number;
  /** Optional topic filter.  Case-insensitive. */
  topic?: string;
  /** Only return articles newer than this.  Default 30 days ago. */
  maxAgeDays?: number;
  /** Only return articles in this language.  ISO 639-1 code. */
  language?: string;
};

const DEFAULT_LIMIT = 500;
const DEFAULT_MAX_AGE_DAYS = 30;

/**
 * Pull embedded Discover articles for in-memory cosine search.
 *
 * Filters:
 *   - `embedding IS NOT NULL` (Phase 3 column)
 *   - within `maxAgeDays` of now (default 30)
 *   - optionally by topic and language
 *
 * Ordering: most recent first (created_at desc). This is the
 * "before-cosine" order — the ranker applies its own final order.
 *
 * Returns an empty array on a DB error (logged). Never throws.
 */
export async function getEmbeddedDiscoverCandidates(
  options: GetCandidatesOptions = {},
): Promise<DiscoverCandidate[]> {
  const limit = options.limit ?? DEFAULT_LIMIT;
  const maxAge = options.maxAgeDays ?? DEFAULT_MAX_AGE_DAYS;
  const cutoff = new Date(Date.now() - maxAge * 24 * 60 * 60 * 1000);

  try {
    const { discoverArticles: d } = schema;
    const conditions = [isNotNull(d.embedding), gte(d.createdAt, cutoff)];
    if (options.topic) conditions.push(eq(d.topic, options.topic.toLowerCase()));
    if (options.language) conditions.push(eq(d.language, options.language.toLowerCase()));

    const rows = await pgDb
      .select({
        id: d.id,
        title: d.title,
        url: d.url,
        domain: d.domain,
        language: d.language,
        publishedAt: d.publishedAt,
        topic: d.topic,
        fullContent: d.fullContent,
        thumbnail: d.thumbnail,
        author: d.author,
        embedding: d.embedding,
        createdAt: d.createdAt,
      })
      .from(d)
      .where(and(...conditions))
      .orderBy(desc(d.createdAt))
      .limit(limit);

    const out: DiscoverCandidate[] = [];
    for (const row of rows) {
      if (!row.embedding || !Array.isArray(row.embedding)) continue;
      out.push({
        id: row.id,
        title: row.title ?? '',
        url: row.url ?? '',
        domain: row.domain ?? '',
        language: row.language ?? 'other',
        publishedAt: row.publishedAt ?? null,
        topic: row.topic ?? 'other',
        fullContent: row.fullContent ?? null,
        thumbnail: row.thumbnail ?? null,
        author: row.author ?? null,
        embedding: row.embedding as number[],
      });
    }
    return out;
  } catch (err) {
    console.error('[supabase/queries] getEmbeddedDiscoverCandidates threw:', err);
    return [];
  }
}
