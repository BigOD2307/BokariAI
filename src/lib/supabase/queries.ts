/**
 * Server-side helpers for the Discover cache.
 *
 * Used by the search agent at query time to look up pre-extracted content
 * from a list of URLs. Bulk lookup via a single `IN (...)` query — one round
 * trip, regardless of how many URLs we ask about.
 */
import { and, inArray, isNotNull } from 'drizzle-orm';
import { pgDb, schema } from '@/lib/db/postgres/client';

export type StoredContent = {
  url: string;
  fullContent: string | null;
  author: string | null;
  publishedAt: Date | null;
  contentHash: string | null;
  extractedAt: Date | null;
};

/**
 * Look up pre-extracted content for a list of URLs.
 *
 * Returns a Map keyed by URL. URLs not in the table are simply absent from
 * the map. URLs whose row has no `fullContent` are also absent.
 *
 * Never throws. On a DB error, logs and returns an empty map.
 */
export async function getStoredContentForUrls(urls: string[]): Promise<Map<string, StoredContent>> {
  if (urls.length === 0) return new Map();

  try {
    const { discoverArticles: d } = schema;
    const rows = await pgDb
      .select({
        url: d.url,
        fullContent: d.fullContent,
        author: d.author,
        publishedAt: d.publishedAt,
        contentHash: d.contentHash,
        extractedAt: d.extractedAt,
      })
      .from(d)
      .where(and(inArray(d.url, urls), isNotNull(d.fullContent)));

    const map = new Map<string, StoredContent>();
    for (const row of rows) {
      if (!row.fullContent) continue;
      map.set(row.url, {
        url: row.url,
        fullContent: row.fullContent,
        author: row.author ?? null,
        publishedAt: row.publishedAt ?? null,
        contentHash: row.contentHash ?? null,
        extractedAt: row.extractedAt ?? null,
      });
    }
    return map;
  } catch (err) {
    console.error('[supabase/queries] getStoredContentForUrls threw:', err);
    return new Map();
  }
}
