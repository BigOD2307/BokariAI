/**
 * The three autonomous content jobs.
 *
 *  - discover-daily   : refresh the Discover feed once a day (all topics).
 *  - articles-rotate  : every 5h, generate one draft article for the *next*
 *                       category in rotation (6 beats → full tour in 30h).
 *                       Drafts wait in the admin review queue (human-in-loop).
 *  - stats-weekly     : refresh "L'Afrique en chiffres" every Monday.
 *
 * Each handler records its run in `scheduler_state` (durable across restarts)
 * and returns a small summary, surfaced by the internal trigger route.
 */
import { CATEGORY_ORDER, getCategory } from '@/lib/blog/categories';
import { generateArticleForCategory } from '@/lib/blog/generate';
import { runDiscoverRefresh } from '@/lib/discover/refreshJob';
import { updateAfricaStats } from '@/lib/stats/update';
import { getCursor, setCursor, markRunning, markDone } from './state';

export type JobSummary = Record<string, unknown> & { job: string };

export async function runDiscoverDaily(): Promise<JobSummary> {
  const job = 'discover-daily';
  await markRunning(job);
  try {
    const summary = await runDiscoverRefresh();
    await markDone(job, summary.success ? 'ok' : 'error', summary.errors?.join('; '));
    return { job, ...summary };
  } catch (err) {
    await markDone(job, 'error', (err as Error)?.message ?? String(err));
    throw err;
  }
}

export async function runArticlesRotation(forceCategory?: string): Promise<JobSummary> {
  const job = 'articles-rotate';
  const cursor = await getCursor(job);
  const slug =
    forceCategory && getCategory(forceCategory)
      ? forceCategory
      : CATEGORY_ORDER[cursor % CATEGORY_ORDER.length];
  await markRunning(job);
  try {
    const res = await generateArticleForCategory(slug);
    // Record the REAL outcome so a skip/failure is visible in scheduler_state
    // (it used to always record 'ok', hiding dry beats and LLM errors).
    await markDone(job, res.ok ? 'ok' : 'error', res.ok ? undefined : res.reason);
    return {
      job,
      category: slug,
      generated: res.ok,
      ...(res.ok
        ? { slug: res.article.slug, title: res.article.title, status: res.article.status }
        : { reason: res.reason }),
    };
  } catch (err) {
    await markDone(job, 'error', (err as Error)?.message ?? String(err));
    throw err;
  } finally {
    // Advance regardless so the rotation never stalls globally on one beat.
    if (!forceCategory) {
      await setCursor(job, (cursor + 1) % CATEGORY_ORDER.length);
    }
  }
}

export async function runStatsWeekly(): Promise<JobSummary> {
  const job = 'stats-weekly';
  await markRunning(job);
  try {
    const summary = await updateAfricaStats();
    await markDone(job, 'ok');
    return { job, ...summary };
  } catch (err) {
    await markDone(job, 'error', (err as Error)?.message ?? String(err));
    throw err;
  }
}

/**
 * Schedule matchers — given "now" (UTC), return the timestamp (ms) of the most
 * recent moment this job was due. The scheduler runs a job when its persisted
 * last-run is older than that moment, which makes the schedule self-correcting:
 * a tick that drifts or a container that was down past the boundary still
 * catches up on the next tick. All times are UTC.
 */
function dailyAt(hour: number) {
  return (now: Date): number => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour));
    if (d.getTime() > now.getTime()) d.setUTCDate(d.getUTCDate() - 1);
    return d.getTime();
  };
}
function everyHours(n: number) {
  return (now: Date): number => {
    const slot = now.getUTCHours() - (now.getUTCHours() % n);
    return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), slot);
  };
}
function weeklyAt(dow: number, hour: number) {
  // dow: 0=Sun … 1=Mon … 6=Sat
  return (now: Date): number => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour));
    const diff = (d.getUTCDay() - dow + 7) % 7;
    d.setUTCDate(d.getUTCDate() - diff);
    if (d.getTime() > now.getTime()) d.setUTCDate(d.getUTCDate() - 7);
    return d.getTime();
  };
}

export type CronJob = {
  name: string;
  /** Most-recent-due timestamp (ms, UTC) for a given "now". */
  lastOccurrence: (now: Date) => number;
  run: () => Promise<JobSummary>;
};

export const JOBS: CronJob[] = [
  { name: 'discover-daily', lastOccurrence: dailyAt(4), run: runDiscoverDaily },
  { name: 'articles-rotate', lastOccurrence: everyHours(5), run: () => runArticlesRotation() },
  { name: 'stats-weekly', lastOccurrence: weeklyAt(1, 3), run: runStatsWeekly },
];

/** Dispatch a job by name (used by the internal trigger route + manual runs). */
export async function runJob(name: string): Promise<JobSummary> {
  const job = JOBS.find((j) => j.name === name);
  if (!job) throw new Error(`unknown job "${name}"`);
  return job.run();
}
