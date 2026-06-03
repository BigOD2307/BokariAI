/**
 * @module cache/schema
 * @description Type defs and row-to-entry mappers for the semantic
 * cache.  Pulled out of `store.ts` so each file stays under the
 * 200-line quality bar.
 *
 * @author Amadou — Dicken AI
 * @version 1.0.0
 */
import { unpackEmbedding } from './vector';

/** A single cached query as exposed to callers. */
export type CacheEntry = {
  id: number;
  query: string;
  queryHash: string;
  embedding: Float32Array;
  response: string;
  metadata: Record<string, unknown>;
  hitCount: number;
  createdAt: number;
  expiresAt: number;
};

/** Row shape as returned by `better-sqlite3` prepared statements. */
export type CacheRow = {
  id: number;
  query: string;
  query_hash: string;
  embedding: Buffer;
  response: string;
  metadata: string;
  hit_count: number;
  created_at: number;
  expires_at: number;
};

/** Map a `CacheRow` to the public `CacheEntry` shape. */
export function rowToEntry(row: CacheRow): CacheEntry {
  return {
    id: row.id,
    query: row.query,
    queryHash: row.query_hash,
    embedding: unpackEmbedding(row.embedding),
    response: row.response,
    metadata: safeParseJson(row.metadata),
    hitCount: row.hit_count,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
}

function safeParseJson(s: string): Record<string, unknown> {
  try {
    const v = JSON.parse(s);
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
