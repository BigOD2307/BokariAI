/**
 * @module cache/store
 * @description SQLite-backed vector cache for repeated research queries.
 *
 * The cache stores: normalised query, BLOB embedding, response,
 * hit count, TTL.  Cosine scan is in JS (small N, sub-ms).  See
 * `vector.ts` for the Float32 packing helpers and `semantic.ts`
 * for the lookup logic.
 *
 * @author Amadou — Dicken AI
 * @version 1.0.0
 */
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import {
  packEmbedding,
  unpackEmbedding,
  cosineSimilarity,
} from './vector';
import { type CacheEntry, type CacheRow, rowToEntry } from './schema';

export type { CacheEntry };

const DATA_DIR = process.env.DATA_DIR || process.cwd();
const CACHE_DIR = path.join(DATA_DIR, 'data');
const CACHE_PATH = path.join(CACHE_DIR, 'cache.sqlite');

/** Prepared-statement bundle.  Keeps the class body focused on
 *  public methods, not plumbing. */
type Stmts = {
  insert: Database.Statement;
  updateByHash: Database.Statement;
  updateHits: Database.Statement;
  getById: Database.Statement;
  getByHash: Database.Statement;
  delete: Database.Statement;
  clear: Database.Statement;
  stats: Database.Statement;
  prune: Database.Statement;
  selectAll: Database.Statement;
};

function prepareStatements(db: Database.Database): Stmts {
  db.exec(`
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
  return {
    insert: db.prepare(`
      INSERT INTO semantic_cache
        (query, query_hash, embedding, response, metadata, hit_count, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, 0, ?, ?)
    `),
    updateByHash: db.prepare(`
      UPDATE semantic_cache
         SET response = ?, metadata = ?, embedding = ?, expires_at = ?
       WHERE id = ?
    `),
    updateHits: db.prepare(
      'UPDATE semantic_cache SET hit_count = hit_count + 1 WHERE id = ?',
    ),
    getById: db.prepare('SELECT * FROM semantic_cache WHERE id = ?'),
    getByHash: db.prepare(
      'SELECT * FROM semantic_cache WHERE query_hash = ? AND expires_at > ?',
    ),
    delete: db.prepare('DELETE FROM semantic_cache WHERE id = ?'),
    clear: db.prepare('DELETE FROM semantic_cache'),
    stats: db.prepare(
      'SELECT COUNT(*) AS count, COALESCE(SUM(hit_count), 0) AS hits FROM semantic_cache',
    ),
    prune: db.prepare('DELETE FROM semantic_cache WHERE expires_at <= ?'),
    selectAll: db.prepare(
      'SELECT * FROM semantic_cache WHERE expires_at > ?',
    ),
  };
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
  private s: Stmts;

  constructor(dbPath: string = CACHE_PATH) {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.s = prepareStatements(this.db);
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
    const existing = this.s.getByHash.get(
      input.queryHash,
      now,
    ) as { id: number } | undefined;
    if (existing) {
      this.s.updateByHash.run(
        input.response,
        JSON.stringify(input.metadata ?? {}),
        packEmbedding(input.embedding),
        now + input.ttlMs,
        existing.id,
      );
      return existing.id;
    }
    const r = this.s.insert.run(
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
    const row = this.s.getByHash.get(hash, Date.now()) as CacheRow | undefined;
    return row ? rowToEntry(row) : null;
  }

  /** Record a hit.  Cheap counter bump. */
  recordHit(id: number): void {
    this.s.updateHits.run(id);
  }

  /** Drop a single entry. */
  delete(id: number): void {
    this.s.delete.run(id);
  }

  /** Drop every entry.  Used by the bench script and by tests. */
  clear(): void {
    this.s.clear.run();
  }

  /** Drop expired entries.  Call this periodically (e.g. on startup). */
  prune(): number {
    const r = this.s.prune.run(Date.now());
    return Number(r.changes);
  }

  /** Cheap cache-wide stats: row count and total hits. */
  stats(): { size: number; hits: number } {
    const row = this.s.stats.get() as { count: number; hits: number };
    return { size: Number(row.count), hits: Number(row.hits) };
  }

  /** Linear scan over the table computing cosine similarity in JS.
   *  Returns up to `limit` entries sorted by similarity (descending).
   *  The caller filters by threshold.
   *
   *  Note: this is O(N).  Swap to an ANN index (sqlite-vss, HNSW)
   *  if the table ever exceeds ~50k entries. */
  scanSimilar(
    embedding: number[],
    threshold: number,
    limit: number = 5,
  ): Array<{ entry: CacheEntry; similarity: number }> {
    const vec = new Float32Array(embedding);
    const rows = this.s.selectAll.all(Date.now()) as CacheRow[];
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

export { cosineSimilarity };
