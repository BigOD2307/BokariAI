/**
 * A minimal, hand-written subset of `@supabase/supabase-js`'s PostgREST
 * client — enough to keep `import supabase from '@/lib/db'` (and every one
 * of its ~7 call sites: the chat write path, quota RPCs, chat ownership
 * assertion, feedback) working with ZERO changes to those call sites,
 * backed by Neon instead of Supabase.
 *
 * Why a shim instead of rewriting each call site to Drizzle: `db/index.ts`
 * is the hottest path in the app (every chat message read/write, every
 * quota check) and its call sites are scattered across 7 files. One
 * carefully-reviewed translation layer, matching the exact chain shapes
 * already in use (`.from().select().eq().maybeSingle()` etc.), is lower risk
 * than distributing that translation across 7 independent edits.
 *
 * This is NOT a general PostgREST reimplementation — it supports exactly the
 * operations actually used in this codebase (grep `from '@/lib/db'` before
 * adding a new one, and add it here deliberately, not speculatively).
 */
import type { Pool, QueryResult } from 'pg';

type Filter = { col: string; op: 'eq' | 'neq' | 'in' | 'gt' | 'is'; val: unknown };
type PgError = { code: string; message: string };

type ManyResult<T> = { data: T[]; error: null } | { data: null; error: PgError };
type OneResult<T> = { data: T; error: null } | { data: null; error: PgError };

function quoteIdent(name: string): string {
  // Table/column names in this codebase are always our own fixed identifiers
  // (never interpolated from user input) — quoting here is about correctness
  // (reserved words, case) not injection defence. Values are always
  // parameterised below.
  return `"${name.replace(/"/g, '""')}"`;
}

function filterClause(filters: Filter[], startIndex: number): { sql: string; params: unknown[] } {
  if (filters.length === 0) return { sql: '', params: [] };
  const params: unknown[] = [];
  const parts = filters.map((f) => {
    const col = quoteIdent(f.col);
    if (f.op === 'is') {
      // Only `.is(col, null)` is used in this codebase — `= NULL` never
      // matches in SQL, has to be `IS NULL`.
      return `${col} IS NULL`;
    }
    const idx = startIndex + params.length;
    if (f.op === 'eq') { params.push(f.val); return `${col} = $${idx}`; }
    if (f.op === 'neq') { params.push(f.val); return `${col} <> $${idx}`; }
    if (f.op === 'gt') { params.push(f.val); return `${col} > $${idx}`; }
    // 'in'
    params.push(f.val);
    return `${col} = ANY($${idx})`;
  });
  return { sql: ` WHERE ${parts.join(' AND ')}`, params };
}

function toPgError(err: unknown): PgError {
  const e = err as { code?: string; message?: string };
  return { code: e.code ?? 'UNKNOWN', message: e.message ?? String(err) };
}

/**
 * `pg` does not serialise JS arrays/objects for `jsonb` columns — a bare
 * array like `['web']` gets sent using Postgres's ARRAY literal wire format
 * (`{web}`), which fails (or silently mis-casts) against a jsonb column
 * expecting `'[...]'::jsonb`. This codebase has no per-column type info to
 * consult (that's the whole point of the shim — it mirrors Supabase's
 * untyped `.insert()`), so plain arrays/objects are JSON-stringified
 * unconditionally. Every jsonb write in this codebase (chats.sources/files,
 * messages.response_blocks, feedback.captured) already passes a plain
 * array/object here, and nothing passes one to a non-jsonb column.
 */
function toSqlParam(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === 'object' && !(value instanceof Date)) return JSON.stringify(value);
  return value;
}

class QueryBuilder<T = Record<string, unknown>> implements PromiseLike<ManyResult<T>> {
  private op: 'select' | 'insert' | 'upsert' | 'update' | 'delete' = 'select';
  private cols = '*';
  private payload: Record<string, unknown> | null = null;
  private onConflictCols: string[] | null = null;
  private filters: Filter[] = [];
  private orderCol: string | null = null;
  private orderAsc = true;
  private limitN: number | null = null;
  private singleMode: 'maybe' | 'exact' | null = null;

  constructor(private pool: Pool, private table: string) {}

  select(cols = '*') {
    this.cols = cols;
    return this;
  }
  insert(payload: Record<string, unknown>) {
    this.op = 'insert';
    this.payload = payload;
    return this;
  }
  upsert(payload: Record<string, unknown>, opts: { onConflict: string }) {
    this.op = 'upsert';
    this.payload = payload;
    this.onConflictCols = opts.onConflict.split(',').map((c) => c.trim());
    return this;
  }
  update(payload: Record<string, unknown>) {
    this.op = 'update';
    this.payload = payload;
    return this;
  }
  delete() {
    this.op = 'delete';
    return this;
  }
  eq(col: string, val: unknown) {
    this.filters.push({ col, op: 'eq', val });
    return this;
  }
  neq(col: string, val: unknown) {
    this.filters.push({ col, op: 'neq', val });
    return this;
  }
  in(col: string, val: unknown[]) {
    this.filters.push({ col, op: 'in', val });
    return this;
  }
  gt(col: string, val: unknown) {
    this.filters.push({ col, op: 'gt', val });
    return this;
  }
  is(col: string, val: null) {
    this.filters.push({ col, op: 'is', val });
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this.orderCol = col;
    this.orderAsc = opts?.ascending ?? true;
    return this;
  }
  limit(n: number) {
    this.limitN = n;
    return this;
  }
  /** Narrows the resolved type to a single row (or null) — same object at
   *  runtime, different compile-time view, same trick `single()` uses. */
  maybeSingle(): PromiseLike<{ data: T | null; error: PgError | null }> {
    this.singleMode = 'maybe';
    return this as unknown as PromiseLike<{ data: T | null; error: PgError | null }>;
  }
  single(): PromiseLike<OneResult<T>> {
    this.singleMode = 'exact';
    return this as unknown as PromiseLike<OneResult<T>>;
  }

  private async run(): Promise<{ data: unknown; error: PgError | null }> {
    try {
      let result: QueryResult;

      if (this.op === 'select') {
        const { sql: where, params } = filterClause(this.filters, 1);
        let sql = `SELECT ${this.cols} FROM ${quoteIdent(this.table)}${where}`;
        if (this.orderCol) sql += ` ORDER BY ${quoteIdent(this.orderCol)} ${this.orderAsc ? 'ASC' : 'DESC'}`;
        if (this.limitN != null) sql += ` LIMIT ${this.limitN}`;
        result = await this.pool.query(sql, params);
      } else if (this.op === 'insert') {
        const entries = Object.entries(this.payload ?? {}).filter(([, v]) => v !== undefined);
        const cols = entries.map(([k]) => quoteIdent(k)).join(', ');
        const placeholders = entries.map((_, i) => `$${i + 1}`).join(', ');
        const params = entries.map(([, v]) => toSqlParam(v));
        const sql = `INSERT INTO ${quoteIdent(this.table)} (${cols}) VALUES (${placeholders}) RETURNING ${this.cols}`;
        result = await this.pool.query(sql, params);
      } else if (this.op === 'upsert') {
        const entries = Object.entries(this.payload ?? {}).filter(([, v]) => v !== undefined);
        const cols = entries.map(([k]) => quoteIdent(k)).join(', ');
        const placeholders = entries.map((_, i) => `$${i + 1}`).join(', ');
        const params = entries.map(([, v]) => toSqlParam(v));
        const conflictCols = (this.onConflictCols ?? []).map(quoteIdent).join(', ');
        const updateCols = entries
          .map(([k]) => k)
          .filter((k) => !(this.onConflictCols ?? []).includes(k));
        const setParts = updateCols.map((k) => `${quoteIdent(k)} = EXCLUDED.${quoteIdent(k)}`).join(', ');
        const sql = `INSERT INTO ${quoteIdent(this.table)} (${cols}) VALUES (${placeholders}) ON CONFLICT (${conflictCols}) DO UPDATE SET ${setParts} RETURNING ${this.cols}`;
        result = await this.pool.query(sql, params);
      } else if (this.op === 'update') {
        const entries = Object.entries(this.payload ?? {}).filter(([, v]) => v !== undefined);
        const setParts = entries.map(([k], i) => `${quoteIdent(k)} = $${i + 1}`).join(', ');
        const setParams = entries.map(([, v]) => toSqlParam(v));
        const { sql: where, params: whereParams } = filterClause(this.filters, entries.length + 1);
        const sql = `UPDATE ${quoteIdent(this.table)} SET ${setParts}${where} RETURNING ${this.cols}`;
        result = await this.pool.query(sql, [...setParams, ...whereParams]);
      } else {
        const { sql: where, params } = filterClause(this.filters, 1);
        const sql = `DELETE FROM ${quoteIdent(this.table)}${where} RETURNING ${this.cols}`;
        result = await this.pool.query(sql, params);
      }

      if (this.singleMode === 'maybe') {
        return { data: result.rows[0] ?? null, error: null };
      }
      if (this.singleMode === 'exact') {
        if (result.rows.length !== 1) {
          return { data: null, error: { code: 'PGRST116', message: 'Expected exactly one row' } };
        }
        return { data: result.rows[0], error: null };
      }
      return { data: result.rows, error: null };
    } catch (err) {
      return { data: null, error: toPgError(err) };
    }
  }

  then<TResult1 = ManyResult<T>, TResult2 = never>(
    onfulfilled?: ((value: ManyResult<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.run().then(
      (r) => (onfulfilled ? onfulfilled(r as ManyResult<T>) : (r as unknown as TResult1)),
      onrejected,
    );
  }
}

type RpcResult = { data: number; error: null } | { data: null; error: PgError };

async function rpc(pool: Pool, fn: string, params: Record<string, unknown>): Promise<RpcResult> {
  try {
    // Direct translation of supabase/migrations/20260901_quota.sql's
    // consume_quota/consume_guest_quota — single atomic UPDATE/INSERT ...
    // RETURNING, so two concurrent requests still can't both pass a limit of
    // one (the property the original plpgsql comment called out).
    if (fn === 'consume_quota') {
      const { p_user, p_cost, p_limit } = params as { p_user: string; p_cost: number; p_limit: number };
      const result = await pool.query(
        `UPDATE users
            SET quota_units_today = CASE WHEN quota_day = CURRENT_DATE THEN quota_units_today + $2 ELSE $2 END,
                quota_day = CURRENT_DATE
          WHERE id = $1
            AND (quota_day <> CURRENT_DATE OR quota_units_today + $2 <= $3)
          RETURNING ($3 - quota_units_today) AS remaining`,
        [p_user, p_cost, p_limit],
      );
      return { data: result.rows[0]?.remaining ?? -1, error: null };
    }
    if (fn === 'consume_guest_quota') {
      const { p_fingerprint, p_cost, p_limit } = params as {
        p_fingerprint: string;
        p_cost: number;
        p_limit: number;
      };
      const result = await pool.query(
        `INSERT INTO guest_quota (fingerprint, quota_units_today, quota_day)
              VALUES ($1, $2, CURRENT_DATE)
         ON CONFLICT (fingerprint) DO UPDATE
                SET quota_units_today = CASE WHEN guest_quota.quota_day = CURRENT_DATE
                                              THEN guest_quota.quota_units_today + $2 ELSE $2 END,
                    quota_day = CURRENT_DATE,
                    updated_at = now()
              WHERE guest_quota.quota_day <> CURRENT_DATE OR guest_quota.quota_units_today + $2 <= $3
          RETURNING ($3 - guest_quota.quota_units_today) AS remaining`,
        [p_fingerprint, p_cost, p_limit],
      );
      return { data: result.rows[0]?.remaining ?? -1, error: null };
    }
    return { data: null, error: { code: 'UNKNOWN_RPC', message: `Unknown RPC: ${fn}` } };
  } catch (err) {
    return { data: null, error: toPgError(err) };
  }
}

export type SupabaseCompatClient = {
  from: <T = Record<string, unknown>>(table: string) => QueryBuilder<T>;
  rpc: (fn: string, params: Record<string, unknown>) => Promise<RpcResult>;
};

export function createCompatClient(pool: Pool): SupabaseCompatClient {
  return {
    from: (table) => new QueryBuilder(pool, table),
    rpc: (fn, params) => rpc(pool, fn, params),
  };
}
