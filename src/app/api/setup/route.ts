import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, HttpError } from '@/lib/auth/require';
import { pool } from '@/lib/db/postgres/client';

/**
 * GET /api/setup
 * Reports whether the Neon Postgres schema is up to date. Used to power the
 * `/setup` operator page.
 *
 * Unlike the old Supabase-era version of this route, there is no "paste this
 * SQL into the dashboard" flow anymore — the schema is Drizzle-managed
 * (`src/lib/db/postgres/schema.ts`, `drizzle.postgres.config.ts`) and applied
 * with `npx drizzle-kit migrate --config=drizzle.postgres.config.ts` against
 * whatever `NEON_DATABASE_URL` points at. This endpoint just reports drift,
 * it doesn't fix it.
 */
export const dynamic = 'force-dynamic';

const EXPECTED_COLUMNS: Record<string, string[]> = {
  users: ['id', 'email', 'password_hash', 'role', 'plan', 'quota_units_today', 'quota_day'],
  chats: ['id', 'user_id', 'title', 'created_at', 'updated_at', 'sources', 'files'],
  messages: ['id', 'message_id', 'chat_id', 'backend_id', 'query', 'created_at', 'response_blocks', 'status'],
  feedback: ['id', 'message_id', 'chat_id', 'user_id', 'rating', 'comment', 'captured'],
  shares: ['id', 'chat_id', 'user_id', 'slug', 'is_indexed', 'view_count'],
  share_views: ['id', 'share_id', 'referrer', 'country', 'user_agent', 'viewed_at'],
  guest_quota: ['fingerprint', 'quota_units_today', 'quota_day'],
  discover_articles: ['id', 'topic', 'title', 'content', 'url', 'batch_id', 'created_at', 'updated_at'],
};

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
  } catch (err) {
    return err instanceof HttpError
      ? err.toResponse()
      : NextResponse.json({}, { status: 404 });
  }

  const tableStatus: Record<string, { exists: boolean; columns?: string[]; missingColumns?: string[] }> = {};

  try {
    const { rows } = await pool.query<{ table_name: string; column_name: string }>(
      `SELECT table_name, column_name
         FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = ANY($1)`,
      [Object.keys(EXPECTED_COLUMNS)],
    );

    const columnsByTable = new Map<string, string[]>();
    for (const row of rows) {
      const cols = columnsByTable.get(row.table_name) ?? [];
      cols.push(row.column_name);
      columnsByTable.set(row.table_name, cols);
    }

    for (const [table, expected] of Object.entries(EXPECTED_COLUMNS)) {
      const cols = columnsByTable.get(table);
      if (!cols) {
        tableStatus[table] = { exists: false };
        continue;
      }
      const missing = expected.filter((c) => !cols.includes(c));
      tableStatus[table] = { exists: true, columns: cols, missingColumns: missing };
    }
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: `Failed to introspect Neon schema: ${(err as Error).message}` },
      { status: 500 },
    );
  }

  const allOk = Object.keys(EXPECTED_COLUMNS).every(
    (t) => tableStatus[t].exists && (tableStatus[t].missingColumns?.length ?? 0) === 0,
  );

  return NextResponse.json({
    ok: allOk,
    tableStatus,
    migrateCommand: 'npx drizzle-kit migrate --config=drizzle.postgres.config.ts',
    schemaFile: 'src/lib/db/postgres/schema.ts',
  });
}
