/**
 * Africa stats store — live values in SQLite (`africa_stats`), merged over the
 * seed definitions in ./schema. The /data page reads `getAfricaStats()`; the
 * weekly cron writes via `setStat()`.
 */
import { all, run } from '@/lib/db/sqlite';
import { STAT_DEFS, sourceById, type StatDef } from './schema';

export type StatValue = {
  key: string;
  value: string;
  numeric: number | null;
  /** Live source URL (from the last refresh) or the seed source. */
  sourceUrl: string | null;
  /** 1-based source id from the seed def. */
  sourceId: number;
  updatedAt: string | null;
};

type Row = {
  key: string;
  value: string;
  numeric: number | null;
  source_url: string | null;
  updated_at: string | null;
};

/** All displayed stats, keyed, with live DB overrides applied over the seed. */
export async function getAfricaStats(): Promise<Record<string, StatValue>> {
  let rows: Row[] = [];
  try {
    rows = await all<Row>('SELECT * FROM africa_stats');
  } catch {
    rows = [];
  }
  const byKey = new Map(rows.map((r) => [r.key, r]));

  const out: Record<string, StatValue> = {};
  for (const def of STAT_DEFS) {
    const live = byKey.get(def.key);
    const seedSource = sourceById(def.sourceId);
    out[def.key] = {
      key: def.key,
      value: live?.value ?? def.seedValue,
      numeric: live?.numeric ?? def.seedNumeric ?? null,
      sourceUrl: live?.source_url ?? seedSource?.url ?? null,
      sourceId: def.sourceId,
      updatedAt: live?.updated_at ?? null,
    };
  }
  return out;
}

export async function setStat(
  def: StatDef,
  value: string,
  numeric: number,
  sourceUrl: string | null,
): Promise<void> {
  const now = new Date().toISOString();
  await run(
    `INSERT INTO africa_stats (key, value, numeric, source_url, updated_at, last_checked_at)
       VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET
       value = excluded.value,
       numeric = excluded.numeric,
       source_url = excluded.source_url,
       updated_at = excluded.updated_at,
       last_checked_at = excluded.last_checked_at`,
    [def.key, value, numeric, sourceUrl, now, now],
  );
}

/** Record that we checked a stat but didn't change it (for observability). */
export async function touchChecked(key: string): Promise<void> {
  const now = new Date().toISOString();
  await run(
    `UPDATE africa_stats SET last_checked_at = ? WHERE key = ?`,
    [now, key],
  );
}
