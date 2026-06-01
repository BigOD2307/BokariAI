/**
 * Server-side helpers for the Discover cache.
 *
 * Used by the search agent at query time to look up pre-extracted content
 * from a list of URLs.  Bulk lookup via Supabase's `in` filter — one round
 * trip, regardless of how many URLs we ask about.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type StoredContent = {
  url: string;
  fullContent: string | null;
  author: string | null;
  publishedAt: Date | null;
  contentHash: string | null;
  extractedAt: Date | null;
};

let _admin: SupabaseClient | null = null;
function getAdmin(): SupabaseClient {
  if (_admin) return _admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('[supabase/queries] Missing SUPABASE env vars.');
  }
  _admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return _admin;
}

/**
 * Look up pre-extracted content for a list of URLs.
 *
 * Returns a Map keyed by URL.  URLs not in the table are simply absent from
 * the map.  URLs whose row has no `full_content` are also absent.
 *
 * Never throws.  On Supabase error, logs and returns an empty map.
 */
export async function getStoredContentForUrls(urls: string[]): Promise<Map<string, StoredContent>> {
  if (urls.length === 0) return new Map();

  try {
    const { data, error } = await getAdmin()
      .from('discover_articles')
      .select('url, full_content, author, published_at, content_hash, extracted_at')
      .in('url', urls)
      .not('full_content', 'is', null);

    if (error) {
      console.error('[supabase/queries] getStoredContentForUrls error:', error.message);
      return new Map();
    }
    if (!data) return new Map();

    const map = new Map<string, StoredContent>();
    for (const row of data) {
      if (!row.full_content) continue;
      map.set(row.url, {
        url: row.url,
        fullContent: row.full_content,
        author: row.author ?? null,
        publishedAt: row.published_at ? new Date(row.published_at) : null,
        contentHash: row.content_hash ?? null,
        extractedAt: row.extracted_at ? new Date(row.extracted_at) : null,
      });
    }
    return map;
  } catch (err) {
    console.error('[supabase/queries] getStoredContentForUrls threw:', err);
    return new Map();
  }
}
