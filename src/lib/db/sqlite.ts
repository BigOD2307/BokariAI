import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import path from 'path';
import fs from 'fs';

/**
 * Real local SQLite layer (sql.js in-memory, persisted to data/db.sqlite).
 *
 * Why sql.js (in-memory + manual save) and not better-sqlite3?
 *   - Zero native bindings, works out of the box in any Node 18+ environment.
 *   - The previous code already shipped sql.js; this just gives it a real,
 *     typed, locked, persistent API surface.
 *
 * Tradeoffs:
 *   - Each write triggers a full db.export() to disk. Acceptable for the
 *     volumes we have (chats, messages, discover articles — not millions of
 *     rows). If/when we outgrow this, swap to better-sqlite3 in one file.
 *   - Writes are serialized through a single promise queue to avoid sql.js
 *     "Database closed" / concurrent-mutation races.
 */

let dbInstance: SqlJsDatabase | null = null;
let initPromise: Promise<SqlJsDatabase> | null = null;
let writeQueue: Promise<unknown> = Promise.resolve();

const DATA_DIR = process.env.DATA_DIR || process.cwd();
const DB_DIR = path.join(DATA_DIR, 'data');
const DB_PATH = path.join(DB_DIR, 'db.sqlite');
// Migrations always live at the project root, regardless of DATA_DIR.
// (Decoupling this means tests and containerized deploys can point DATA_DIR
// at a writable volume without losing access to the schema.)
const MIGRATIONS_DIR = path.join(process.cwd(), 'drizzle');

function sanitizeSql(content: string): string[] {
  return content
    .split(/--> statement-breakpoint/g)
    .map((stmt) =>
      stmt
        .split(/\r?\n/)
        .filter((l) => !l.trim().startsWith('-->'))
        .join('\n')
        .trim(),
    )
    .filter((stmt) => stmt.length > 0);
}

function applyMigrations(database: SqlJsDatabase): void {
  database.run(`
    CREATE TABLE IF NOT EXISTS ran_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      run_on DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  if (!fs.existsSync(MIGRATIONS_DIR)) return;

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const name = file.split('_')[0] || file;
    const existing = database.exec(
      `SELECT 1 FROM ran_migrations WHERE name = '${name.replace(/'/g, "''")}'`,
    );
    if (existing.length > 0 && existing[0].values.length > 0) {
      continue;
    }
    try {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
      const statements = sanitizeSql(sql);
      statements.forEach((s) => {
        if (s.trim()) database.run(s);
      });
      database.run(
        `INSERT OR IGNORE INTO ran_migrations (name) VALUES ('${name.replace(/'/g, "''")}')`,
      );
    } catch (err) {
      console.error(`[Bokari DB] Migration ${file} failed:`, err);
      throw err;
    }
  }
}

function persist(): void {
  if (!dbInstance) return;
  try {
    const data = dbInstance.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  } catch (err) {
    console.error('[Bokari DB] persist failed:', err);
  }
}

async function init(): Promise<SqlJsDatabase> {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    dbInstance = new SQL.Database(fs.readFileSync(DB_PATH));
  } else {
    dbInstance = new SQL.Database();
  }
  applyMigrations(dbInstance);
  persist();
  return dbInstance;
}

async function getDb(): Promise<SqlJsDatabase> {
  if (dbInstance) return dbInstance;
  if (!initPromise) {
    initPromise = init().catch((err) => {
      initPromise = null;
      throw err;
    });
  }
  return initPromise;
}

export type RunResult = { changes: number; lastInsertRowid: number };

export async function all<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const database = await getDb();
  const out: T[] = [];
  const stmt = database.prepare(sql);
  try {
    stmt.bind(params as any);
    while (stmt.step()) {
      out.push(stmt.getAsObject() as unknown as T);
    }
    return out;
  } finally {
    stmt.free();
  }
}

export async function get<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await all<T>(sql, params);
  return rows[0] ?? null;
}

function lastInsertRowId(database: SqlJsDatabase): number {
  try {
    const r = database.exec('SELECT last_insert_rowid() AS id');
    if (r.length > 0 && r[0].values.length > 0) {
      return Number(r[0].values[0][0]) || 0;
    }
  } catch {
    /* ignore */
  }
  return 0;
}

export async function run(
  sql: string,
  params: unknown[] = [],
): Promise<RunResult> {
  const database = await getDb();
  return new Promise<RunResult>((resolve, reject) => {
    writeQueue = writeQueue.then(() => {
      try {
        database.run(sql, params);
        const changes = database.getRowsModified();
        const lastInsertRowid = lastInsertRowId(database);
        persist();
        resolve({ changes, lastInsertRowid });
      } catch (err) {
        reject(err);
      }
    }, reject);
  });
}

export async function exec(sql: string): Promise<void> {
  const database = await getDb();
  return new Promise<void>((resolve, reject) => {
    writeQueue = writeQueue.then(() => {
      try {
        database.exec(sql);
        persist();
        resolve();
      } catch (err) {
        reject(err);
      }
    }, reject);
  });
}

export async function transaction<T>(
  fn: (tx: {
    all: typeof all;
    get: typeof get;
    run: typeof run;
    exec: typeof exec;
  }) => Promise<T>,
): Promise<T> {
  const database = await getDb();
  return new Promise<T>((resolve, reject) => {
    writeQueue = writeQueue.then(async () => {
      const txApi = { all, get, run: runInTx, exec: execInTx };
      database.run('BEGIN');
      try {
        const result = await fn(txApi);
        database.run('COMMIT');
        persist();
        resolve(result);
      } catch (err) {
        try {
          database.run('ROLLBACK');
        } catch {
          /* ignore */
        }
        reject(err);
      }
    }, reject);
  });

  async function runInTx(sql: string, params: unknown[] = []): Promise<RunResult> {
    database.run(sql, params);
    return {
      changes: database.getRowsModified(),
      lastInsertRowid: lastInsertRowId(database),
    };
  }
  async function execInTx(sql: string): Promise<void> {
    database.exec(sql);
  }
}

/**
 * Best-effort helper for INSERT ... ON CONFLICT(...) DO UPDATE (upsert).
 * Uses SQLite's native UPSERT clause (sqlite >= 3.24, we have 3.40+).
 */
export async function upsert(
  table: string,
  rows: Record<string, unknown>[],
  conflictColumns: string[],
): Promise<RunResult> {
  if (rows.length === 0) {
    return { changes: 0, lastInsertRowid: 0 };
  }
  const columns = Object.keys(rows[0]);
  const placeholders = rows.map(() => `(${columns.map(() => '?').join(', ')})`).join(', ');
  const updateSet = columns
    .filter((c) => !conflictColumns.includes(c))
    .map((c) => `${c} = excluded.${c}`)
    .join(', ');

  const sql = `
    INSERT INTO ${table} (${columns.join(', ')})
    VALUES ${placeholders}
    ON CONFLICT(${conflictColumns.join(', ')}) DO UPDATE SET
      ${updateSet}
  `;

  const flatParams: unknown[] = [];
  for (const row of rows) {
    for (const col of columns) {
      flatParams.push(row[col] ?? null);
    }
  }
  return run(sql, flatParams);
}
