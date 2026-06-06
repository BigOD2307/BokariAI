/**
 * In-process scheduler (zero-dependency), started once from instrumentation.ts.
 *
 * The app runs as a single standalone Node process in one Docker container, so
 * an in-process scheduler is the simplest reliable option: it shares the DB,
 * the LLM provider config, and the search stack with the rest of the app.
 *
 * How it works: a one-minute tick compares each job's persisted last-run (in
 * SQLite, see ./state) against its "most recent due time". If the last run is
 * older, the job is due and fires. That makes the schedule self-correcting —
 * drift or downtime past a boundary is caught up on the next tick — and durable
 * across redeploys (the rotation cursor + last-run survive in the data volume).
 *
 * Disable with BOKARI_SCHEDULER_ENABLED=false.
 */
import { JOBS } from './jobs';
import { getJobState, initJobIfNew } from './state';

declare global {
  // eslint-disable-next-line no-var
  var __bokariSchedulerStarted: boolean | undefined;
}

const TICK_MS = 60_000;
const running = new Set<string>();

async function tick(): Promise<void> {
  const now = new Date();
  for (const job of JOBS) {
    if (running.has(job.name)) continue;
    let due = false;
    try {
      const occurrence = job.lastOccurrence(now);
      const state = await getJobState(job.name);
      const lastRun = state?.last_run_at ? Date.parse(state.last_run_at) : 0;
      due = !Number.isNaN(lastRun) && lastRun < occurrence;
    } catch (err) {
      console.error(`[scheduler] ${job.name} due-check failed:`, err);
      continue;
    }
    if (!due) continue;

    running.add(job.name);
    console.log(`[scheduler] ${job.name} firing at ${now.toISOString()}`);
    void job
      .run()
      .then((summary) => console.log(`[scheduler] ${job.name} done:`, JSON.stringify(summary)))
      .catch((err) => console.error(`[scheduler] ${job.name} failed:`, err))
      .finally(() => running.delete(job.name));
  }
}

export function startScheduler(): void {
  if (process.env.BOKARI_SCHEDULER_ENABLED === 'false') {
    console.log('[scheduler] disabled via BOKARI_SCHEDULER_ENABLED=false');
    return;
  }
  if (globalThis.__bokariSchedulerStarted) return;
  globalThis.__bokariSchedulerStarted = true;

  // Stamp first-boot last-run so we don't fire every job at once on a fresh
  // volume, then start ticking. Errors here must not crash startup.
  void (async () => {
    try {
      for (const job of JOBS) await initJobIfNew(job.name);
    } catch (err) {
      console.error('[scheduler] init failed:', err);
    }
    const interval = setInterval(() => void tick(), TICK_MS);
    // Don't keep the event loop alive solely for the scheduler.
    if (typeof interval.unref === 'function') interval.unref();
    console.log(
      `[scheduler] started — jobs: ${JOBS.map((j) => j.name).join(', ')} (tick ${TICK_MS / 1000}s, UTC)`,
    );
  })();
}
