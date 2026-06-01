import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

/**
 * GET /api/setup
 * Returns the current schema status and the SQL needed to install it.
 * Used by the /setup wizard to tell operators what to do.
 */
export const dynamic = 'force-dynamic';

const REQUIRED_TABLES = ['chats', 'messages', 'discover_articles', 'profiles'];

const EXPECTED_COLUMNS: Record<string, string[]> = {
  chats: ['id', 'user_id', 'title', 'created_at', 'sources', 'files'],
  messages: ['id', 'message_id', 'chat_id', 'backend_id', 'query', 'created_at', 'response_blocks', 'status'],
  discover_articles: ['id', 'topic', 'title', 'content', 'url', 'batch_id', 'created_at', 'updated_at'],
  profiles: ['id', 'email', 'plan', 'questions_today'],
};

export async function GET(_req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing in .env.local',
      },
      { status: 500 },
    );
  }

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const tableStatus: Record<string, { exists: boolean; columns?: string[]; missingColumns?: string[] }> = {};

  for (const table of REQUIRED_TABLES) {
    const { data, error } = await supabase.from(table).select('*').limit(0);
    if (error && /does not exist/i.test(error.message)) {
      tableStatus[table] = { exists: false };
    } else if (error) {
      tableStatus[table] = { exists: false };
    } else {
      const expected = EXPECTED_COLUMNS[table] || [];
      const present = (data as unknown[]) && (data as any[]).length === 0 ? expected : expected;
      // The .select('*').limit(0) trick: data is empty array, we can't see columns from it.
      // Use OpenAPI metadata via /rest/v1/ to introspect.
      const cols = await introspectColumns(supabase, table);
      const missing = expected.filter((c) => !cols.includes(c));
      tableStatus[table] = { exists: true, columns: cols, missingColumns: missing };
    }
  }

  const allOk = REQUIRED_TABLES.every((t) => tableStatus[t].exists);
  const sqlPath = path.join(process.cwd(), 'supabase', 'migrations', '20260601_initial.sql');
  let sql = '';
  try {
    sql = fs.readFileSync(sqlPath, 'utf-8');
  } catch {
    sql = '-- migration file missing in repo';
  }

  return NextResponse.json({
    ok: allOk,
    projectRef: process.env.SUPABASE_PROJECT_ID,
    dashboardSqlEditor: `https://supabase.com/dashboard/project/${process.env.SUPABASE_PROJECT_ID}/sql/new`,
    tableStatus,
    migration: {
      filename: 'supabase/migrations/20260601_initial.sql',
      sql,
    },
  });
}

async function introspectColumns(
  supabase: ReturnType<typeof createClient<any>>,
  table: string,
): Promise<string[]> {
  // Read the OpenAPI spec to get the columns of a given table.
  // Cheap, no extra connection needed.
  try {
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/?apikey=${encodeURIComponent(process.env.SUPABASE_SERVICE_ROLE_KEY || '')}`;
    const r = await fetch(url, { headers: { Accept: 'application/openapi+json' } });
    const spec = (await r.json()) as any;
    const schema = spec?.definitions?.[table] || spec?.components?.schemas?.[table];
    if (schema?.properties) {
      return Object.keys(schema.properties);
    }
  } catch {
    /* ignore */
  }
  return [];
}
