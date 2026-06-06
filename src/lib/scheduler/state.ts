/**
 * Persistent scheduler bookkeeping (SQLite, survives container restarts).
 *
 * Each cron job owns one row in `scheduler_state`:
 *   - `cursor`       — rotation index (the articles job rotates through the 6
 *                      categories; Discover/stats ignore it).
 *   - `last_run_at`  — ISO of the last attempt (used to avoid double-firing on
 *                      a restart, and surfaced in the admin/health view).
 *   - `last_status`  — 'ok' | 'error' | 'running'.
 *
 * Because the container is single-instance, we don't need cross-process locks —
 * just durable state so a redeploy doesn't lose the rotation position.
 */
import { get, run } from '@/lib/db/sqlite';

export type JobState = {
  job: string;
  cursor: number;
  last_run_at: string | null;
  last_status: string | null;
  last_error: string | null;
  runs: number;
};

export async function getJobState(job: string): Promise<JobState | null> {
  return get<JobState>('SELECT * FROM scheduler_state WHERE job = ?', [job]);
}

async function ensureRow(job: string): Promise<void> {
  await run('INSERT OR IGNORE INTO scheduler_state (job) VALUES (?)', [job]);
}

/**
 * On a brand-new install, stamp `last_run_at = now` so the catch-up logic
 * doesn't fire every job at once on first boot (a "thundering herd"). On an
 * existing volume this is a no-op (the row already exists), so missed-window
 * catch-up after a redeploy still works.
 */
export async function initJobIfNew(job: string): Promise<void> {
  await run(
    `INSERT OR IGNORE INTO scheduler_state (job, last_run_at, last_status) VALUES (?, ?, 'init')`,
    [job, new Date().toISOString()],
  );
}

export async function getCursor(job: string): Promise<number> {
  const state = await getJobState(job);
  return state?.cursor ?? 0;
}

export async function setCursor(job: string, cursor: number): Promise<void> {
  await ensureRow(job);
  await run('UPDATE scheduler_state SET cursor = ? WHERE job = ?', [cursor, job]);
}

export async function markRunning(job: string): Promise<void> {
  await ensureRow(job);
  await run(
    `UPDATE scheduler_state
       SET last_status = 'running', last_run_at = ?, runs = runs + 1
     WHERE job = ?`,
    [new Date().toISOString(), job],
  );
}

export async function markDone(
  job: string,
  status: 'ok' | 'error',
  error?: string,
): Promise<void> {
  await ensureRow(job);
  await run(
    `UPDATE scheduler_state SET last_status = ?, last_error = ? WHERE job = ?`,
    [status, error ?? null, job],
  );
}

/**
 * Has `job` already run within the last `windowMs`? Lets the scheduler skip a
 * tick that a recent restart already covered (the in-process timer resets to
 * "fire on next boundary", so without this a redeploy near a boundary could
 * double-run an expensive job).
 */
export async function ranRecently(job: string, windowMs: number): Promise<boolean> {
  const state = await getJobState(job);
  if (!state?.last_run_at) return false;
  const last = Date.parse(state.last_run_at);
  if (Number.isNaN(last)) return false;
  return Date.now() - last < windowMs;
}
