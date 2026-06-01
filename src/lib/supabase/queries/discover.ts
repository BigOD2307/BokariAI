/**
 * @module supabase/queries/discover
 * @description Server-side helpers for the Discover table — Phase 4+
 * additions on top of `getStoredContentForUrls` from Phase 2.
 *
 * `getEmbeddedDiscoverCandidates` pulls the most recent articles that
 * have a BGE-M3 embedding, ready to be cosine-scored in JS.  We do
 * NOT use this for the ranker (which works on the in-memory
 * candidate set); this is for the search agent and the citation
 * engine.
 *
 * @author Amadou — Dicken AI
 * @version 1.0.0
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
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

let _admin: SupabaseClient | null = null;
function getAdmin(): SupabaseClient {
  if (_admin) return _admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('[supabase/queries/discover] Missing SUPABASE env vars.');
  }
  _admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return _admin;
}

/**
 * Pull embedded Discover articles for in-memory cosine search.
 *
 * Filters:
 *   - `embedding IS NOT NULL` (Phase 3 column)
 *   - within `maxAgeDays` of now (default 30)
 *   - optionally by topic and language
 *
 * Ordering: most recent first (created_at desc).  This is the
 * "before-cosine" order — the ranker applies its own final order.
 *
 * Returns an empty array on Supabase error (logged).  Never throws.
 */
export async function getEmbeddedDiscoverCandidates(
  options: GetCandidatesOptions = {},
): Promise<DiscoverCandidate[]> {
  const limit = options.limit ?? DEFAULT_LIMIT;
  const maxAge = options.maxAgeDays ?? DEFAULT_MAX_AGE_DAYS;
  const cutoff = new Date(Date.now() - maxAge * 24 * 60 * 60 * 1000).toISOString();

  try {
    let q = getAdmin()
      .from('discover_articles')
      .select(
        'id, title, url, domain, language, published_at, topic, full_content, thumbnail, author, embedding, created_at',
      )
      .not('embedding', 'is', null)
      .gte('created_at', cutoff)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (options.topic) q = q.eq('topic', options.topic.toLowerCase());
    if (options.language) q = q.eq('language', options.language.toLowerCase());

    const { data, error } = await q;
    if (error) {
      console.error('[supabase/queries] getEmbeddedDiscoverCandidates error:', error.message);
      return [];
    }
    if (!data) return [];

    const out: DiscoverCandidate[] = [];
    for (const row of data) {
      if (!row.embedding || !Array.isArray(row.embedding)) continue;
      out.push({
        id: row.id,
        title: row.title ?? '',
        url: row.url ?? '',
        domain: row.domain ?? '',
        language: row.language ?? 'other',
        publishedAt: row.published_at ? new Date(row.published_at) : null,
        topic: row.topic ?? 'other',
        fullContent: row.full_content ?? null,
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
