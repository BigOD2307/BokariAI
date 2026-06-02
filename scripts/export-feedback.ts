/**
 * scripts/export-feedback.ts
 *
 * Phase 8: dump the feedback table to JSONL for fine-tuning.
 *
 * Each row in `public.feedback` already contains a self-contained
 * `captured` JSONB blob (query, response, sources, metadata).  This
 * script flattens it into a one-line-per-record JSON file that can be
 * fed straight to a fine-tuning pipeline (OpenAI, Together, Axolotl,
 * whatever).
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=… npx tsx scripts/export-feedback.ts
 *   npx tsx scripts/export-feedback.ts --positive         # 👍 only
 *   npx tsx scripts/export-feedback.ts --negative         # 👎 only
 *   npx tsx scripts/export-feedback.ts --with-comment     # any rating, comment != null
 *   npx tsx scripts/export-feedback.ts --out=path.jsonl
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in env (reads the same way as
 * `embed-fixture.ts` reads OPENROUTER_API_KEY — set it in your shell
 * or in a `.env` loaded by your task runner).
 *
 * The output schema (one record per line):
 *   {
 *     messageId: string,
 *     chatId: string | null,
 *     userId: string | null,
 *     rating: 1 | -1,
 *     comment: string | null,
 *     createdAt: string,             // ISO 8601
 *     query: string,
 *     response: string,
 *     sources: { url, title, domain?, source? }[],
 *     metadata: { chatProvider, chatModel, ... }    // all the Bokari internals
 *   }
 */
import { createClient } from '@supabase/supabase-js';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';

export interface CapturedContext {
  query: string;
  response: string;
  sources: Array<{
    url: string;
    title: string;
    domain?: string;
    source?: string;
  }>;
  metadata: Record<string, unknown>;
}

export interface FeedbackRow {
  id: number;
  message_id: string;
  chat_id: string | null;
  user_id: string | null;
  rating: number;
  comment: string | null;
  captured: CapturedContext;
  created_at: string;
  updated_at: string;
}

export interface ExportRecord {
  messageId: string;
  chatId: string | null;
  userId: string | null;
  rating: 1 | -1;
  comment: string | null;
  createdAt: string;
  query: string;
  response: string;
  sources: CapturedContext['sources'];
  metadata: Record<string, unknown>;
}

const FLAG_BOOL_FLAGS = new Set(['--positive', '--negative', '--with-comment']);
const DEFAULT_OUT = join('data', 'feedback.jsonl');

export const parseArgs = (argv: string[]): { flags: Set<string>; out: string } => {
  const flags = new Set<string>();
  let out = DEFAULT_OUT;
  for (const arg of argv) {
    if (FLAG_BOOL_FLAGS.has(arg)) {
      flags.add(arg);
      continue;
    }
    if (arg.startsWith('--out=')) {
      out = arg.slice('--out='.length);
    }
  }
  return { flags, out };
};

export const filterRows = (
  rows: FeedbackRow[],
  flags: Set<string>,
): FeedbackRow[] => {
  let out = rows.filter((r) => r.rating === 1 || r.rating === -1);
  if (flags.has('--positive')) out = out.filter((r) => r.rating === 1);
  if (flags.has('--negative')) out = out.filter((r) => r.rating === -1);
  if (flags.has('--with-comment'))
    out = out.filter((r) => (r.comment ?? '').trim().length > 0);
  return out;
};

export const toRecord = (row: FeedbackRow): ExportRecord => ({
  messageId: row.message_id,
  chatId: row.chat_id,
  userId: row.user_id,
  rating: row.rating === 1 ? 1 : -1,
  comment: row.comment,
  createdAt: row.created_at,
  query: row.captured?.query ?? '',
  response: row.captured?.response ?? '',
  sources: row.captured?.sources ?? [],
  metadata: row.captured?.metadata ?? {},
});

const fetchAll = async (): Promise<FeedbackRow[]> => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      '[export-feedback] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env',
    );
  }
  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const PAGE = 1000;
  let from = 0;
  const all: FeedbackRow[] = [];

  while (true) {
    const { data, error } = await supabase
      .from('feedback')
      .select('*')
      .order('created_at', { ascending: true })
      .range(from, from + PAGE - 1);

    if (error) {
      throw new Error(`[export-feedback] Supabase error: ${error.message}`);
    }
    if (!data || data.length === 0) break;
    all.push(...(data as FeedbackRow[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }

  return all;
};

const main = async () => {
  const { flags, out } = parseArgs(process.argv.slice(2));
  console.log(
    `[export-feedback] filters: ${[...flags].join(', ') || 'none (all rows)'}`,
  );
  console.log(`[export-feedback] output:  ${out}`);

  const rows = await fetchAll();
  const filtered = filterRows(rows, flags);
  console.log(
    `[export-feedback] fetched: ${rows.length}, after filter: ${filtered.length}`,
  );

  const records = filtered.map(toRecord);
  const jsonl = records.map((r) => JSON.stringify(r)).join('\n');

  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, jsonl + (jsonl.length > 0 ? '\n' : ''), 'utf8');

  const counts = {
    positive: records.filter((r) => r.rating === 1).length,
    negative: records.filter((r) => r.rating === -1).length,
    withComment: records.filter((r) => (r.comment ?? '').trim().length > 0)
      .length,
  };
  console.log(
    `[export-feedback] wrote ${records.length} records  (👍 ${counts.positive}, 👎 ${counts.negative}, with-comment ${counts.withComment})`,
  );
};

// Only run when invoked directly (not when imported by tests).
const isDirect =
  typeof process !== 'undefined' &&
  process.argv[1] &&
  /export-feedback\.(ts|js)$/.test(process.argv[1]);

if (isDirect) {
  main().catch((err) => {
    console.error('[export-feedback] failed:', err);
    process.exit(1);
  });
}
