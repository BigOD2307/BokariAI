/**
 * @module cache/store
 * @description SQLite-backed vector cache for repeated research queries.
 *
 * Why a separate SQLite file (`{DATA_DIR}/cache.sqlite`) and not the
 * main `db.sqlite`?
 *   - Decouples cache lifecycle from app data. We can drop the cache
 *     without touching user state.
 *   - `better-sqlite3` is synchronous and ~10x faster than sql.js for
 *     the small, high-throughput write pattern of a cache.
 *   - Keeps the cache out of the migration pipeline — we own the
 *     schema, the migrations folder doesn't.
 *
 * The cache stores:
 *   - the normalised query string (so we can show the user "served
 *     from cache"),
 *   - the query embedding (BLOB, packed Float32Array bytes),
 *   - the cached response payload (JSON),
 *   - a hit count and a TTL timestamp.
 *
 * The cosine similarity scan is done in JS (small N — we keep <5k
 * rows) so we don't need a custom SQLite extension.  See
 * `semantic.ts` for the lookup logic.
 *
 * @author Amadou — Dicken AI
 * @version 1.0.0
 */
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DATA_DIR = process.env.DATA_DIR || process.cwd();
const CACHE_DIR = path.join(DATA_DIR, 'data');
const CACHE_PATH = path.join(CACHE_DIR, 'cache.sqlite');

/** A single cached query.  Embedding is stored as a packed
 *  Float32Array buffer — see `packEmbedding` / `unpackEmbedding`. */
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

/** Pack a JS number[] into a Float32Array-backed Buffer for SQLite. */
export function packEmbedding(vec: number[]): Buffer {
  return Buffer.from(new Float32Array(vec).buffer);
}

/** Inverse of `packEmbedding`.  Allocates a new Float32Array. */
export function unpackEmbedding(buf: Buffer): Float32Array {
  // Slice the buffer so the F32A owns its memory and the GC can free it
  // independently of any other Buffer that happens to share the pool.
  return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4).slice();
}

/** Cosine similarity between two equally-sized vectors.
 *  Returns 0 if either is the zero vector. */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    const av = a[i]!;
    const bv = b[i]!;
    dot += av * bv;
    na += av * av;
    nb += bv * bv;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/**
 * Lightweight wrapper around `better-sqlite3` for the semantic cache.
 *
 * Usage:
 *   const cache = new SemanticCache();
 *   cache.upsert({ query, queryHash, embedding, response, metadata, ttlMs });
 *   const hits = cache.scanSimilar(embedding, 0.92, 5);
 */
export class SemanticCache {
  private db: Database.Database;
  private insertStmt: Database.Statement;
  private updateHitsStmt: Database.Statement;
  private getByIdStmt: Database.Statement;
  private getByHashStmt: Database.Statement;
  private deleteStmt: Database.Statement;
  private clearStmt: Database.Statement;
  private statsStmt: Database.Statement;
  private pruneStmt: Database.Statement;

  constructor(dbPath: string = CACHE_PATH) {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS semantic_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        query TEXT NOT NULL,
        query_hash TEXT NOT NULL,
        embedding BLOB NOT NULL,
        response TEXT NOT NULL,
        metadata TEXT NOT NULL DEFAULT '{}',
        hit_count INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_semantic_cache_hash
        ON semantic_cache(query_hash);
      CREATE INDEX IF NOT EXISTS idx_semantic_cache_expires
        ON semantic_cache(expires_at);
    `);

    this.insertStmt = this.db.prepare(`
      INSERT INTO semantic_cache
        (query, query_hash, embedding, response, metadata, hit_count, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, 0, ?, ?)
    `);
    this.updateHitsStmt = this.db.prepare(
      'UPDATE semantic_cache SET hit_count = hit_count + 1 WHERE id = ?',
    );
    this.getByIdStmt = this.db.prepare(
      'SELECT * FROM semantic_cache WHERE id = ?',
    );
    this.getByHashStmt = this.db.prepare(
      'SELECT * FROM semantic_cache WHERE query_hash = ? AND expires_at > ?',
    );
    this.deleteStmt = this.db.prepare('DELETE FROM semantic_cache WHERE id = ?');
    this.clearStmt = this.db.prepare('DELETE FROM semantic_cache');
    this.statsStmt = this.db.prepare(
      'SELECT COUNT(*) AS count, COALESCE(SUM(hit_count), 0) AS hits FROM semantic_cache',
    );
    this.pruneStmt = this.db.prepare('DELETE FROM semantic_cache WHERE expires_at <= ?');
  }

  /** Insert or update an entry.  If a row with the same hash exists,
   *  we update its response and refresh the expiry.  Returns the
   *  row id. */
  upsert(input: {
    query: string;
    queryHash: string;
    embedding: number[];
    response: string;
    metadata?: Record<string, unknown>;
    ttlMs: number;
  }): number {
    const now = Date.now();
    const existing = this.getByHashStmt.get(
      input.queryHash,
      now,
    ) as { id: number } | undefined;
    if (existing) {
      this.db
        .prepare(
          `UPDATE semantic_cache
              SET response = ?, metadata = ?, embedding = ?, expires_at = ?
            WHERE id = ?`,
        )
        .run(
          input.response,
          JSON.stringify(input.metadata ?? {}),
          packEmbedding(input.embedding),
          now + input.ttlMs,
          existing.id,
        );
      return existing.id;
    }
    const r = this.insertStmt.run(
      input.query,
      input.queryHash,
      packEmbedding(input.embedding),
      input.response,
      JSON.stringify(input.metadata ?? {}),
      now,
      now + input.ttlMs,
    );
    return Number(r.lastInsertRowid);
  }

  /** Look up an entry by exact hash. */
  getByHash(hash: string): CacheEntry | null {
    const now = Date.now();
    const row = this.getByHashStmt.get(hash, now) as CacheRow | undefined;
    if (!row) return null;
    return rowToEntry(row);
  }

  /** Record a hit.  Cheap counter bump. */
  recordHit(id: number): void {
    this.updateHitsStmt.run(id);
  }

  /** Drop a single entry. */
  delete(id: number): void {
    this.deleteStmt.run(id);
  }

  /** Drop every entry.  Used by the bench script and by tests. */
  clear(): void {
    this.clearStmt.run();
  }

  /** Drop expired entries.  Call this periodically (e.g. on startup). */
  prune(): number {
    const r = this.pruneStmt.run(Date.now());
    return Number(r.changes);
  }

  /** Cheap cache-wide stats: row count and total hits. */
  stats(): { size: number; hits: number } {
    const row = this.statsStmt.get() as { count: number; hits: number };
    return { size: Number(row.count), hits: Number(row.hits) };
  }

  /** Linear scan over the table computing cosine similarity in JS.
   *  Returns up to `limit` entries sorted by similarity (descending).
   *  The caller filters by threshold.
   *
   *  Note: this is O(N) per call.  For our use case (a few thousand
   *  queries) this is sub-millisecond.  If we ever exceed ~50k entries
   *  we should swap in an ANN index (sqlite-vss or HNSW). */
  scanSimilar(
    embedding: number[],
    threshold: number,
    limit: number = 5,
  ): Array<{ entry: CacheEntry; similarity: number }> {
    const vec = new Float32Array(embedding);
    const rows = this.db
      .prepare(
        'SELECT * FROM semantic_cache WHERE expires_at > ?',
      )
      .all(Date.now()) as CacheRow[];
    const scored: Array<{ entry: CacheEntry; similarity: number }> = [];
    for (const row of rows) {
      const entry = rowToEntry(row);
      const sim = cosineSimilarity(vec, entry.embedding);
      if (sim >= threshold) {
        scored.push({ entry, similarity: sim });
      }
    }
    scored.sort((a, b) => b.similarity - a.similarity);
    return scored.slice(0, limit);
  }

  /** Close the underlying SQLite handle.  After this, the cache is unusable. */
  close(): void {
    this.db.close();
  }
}

type CacheRow = {
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

function rowToEntry(row: CacheRow): CacheEntry {
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
