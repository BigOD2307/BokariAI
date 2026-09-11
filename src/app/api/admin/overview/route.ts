/**
 * GET /api/admin/overview — dashboard payload for /admin:
 *  - scheduler jobs: last run, status, error, cursor (previously invisible —
 *    a job failing for three weeks had nowhere to be seen),
 *  - news corpus counters (articles, embedded, sources active/disabled),
 *  - article counters by status.
 */
import { requireAdmin, HttpError } from '@/lib/auth/require';
import { all } from '@/lib/db/sqlite';
import { JOBS } from '@/lib/scheduler/jobs';
import { getJobState } from '@/lib/scheduler/state';
import { listArticles } from '@/lib/blog/store';
import { pgDb } from '@/lib/db/postgres/client';
import { newsArticles, newsSources } from '@/lib/db/postgres/schema';
import { sql } from 'drizzle-orm';
import { summarizeUsage } from '@/lib/ai/usage';
import { fastTierStatus } from '@/lib/ai/resolve';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    await requireAdmin(req);
  } catch (err) {
    return err instanceof HttpError
      ? err.toResponse()
      : Response.json({}, { status: 404 });
  }

  // Scheduler state — one row per registered job.
  const jobs = await Promise.all(
    JOBS.map(async (job) => {
      const state = await getJobState(job.name);
      return {
        name: job.name,
        cursor: state?.cursor ?? 0,
        lastRunAt: state?.last_run_at ?? null,
        lastStatus: state?.last_status ?? null,
        lastError: state?.last_error ?? null,
        runs: state?.runs ?? 0,
      };
    }),
  );

  // Article counters by status.
  const articlesByStatus = { draft: 0, published: 0, rejected: 0 };
  for (const status of ['draft', 'published', 'rejected'] as const) {
    try {
      articlesByStatus[status] = (
        await listArticles({ status, limit: 1000 })
      ).length;
    } catch {
      /* keep 0 */
    }
  }

  // News corpus (Neon).
  let corpus = {
    articles: 0,
    embedded: 0,
    sourcesEnabled: 0,
    sourcesDisabled: 0,
    sourcesFailing: 0,
  };
  try {
    const [a] = await pgDb
      .select({
        total: sql<number>`count(*)::int`,
        embedded: sql<number>`count(${newsArticles.embedding})::int`,
      })
      .from(newsArticles);
    const [s] = await pgDb
      .select({
        enabled: sql<number>`count(*) filter (where ${newsSources.enabled})::int`,
        disabled: sql<number>`count(*) filter (where not ${newsSources.enabled})::int`,
        failing: sql<number>`count(*) filter (where ${newsSources.consecutiveFailures} >= 3)::int`,
      })
      .from(newsSources);
    corpus = {
      articles: a?.total ?? 0,
      embedded: a?.embedded ?? 0,
      sourcesEnabled: s?.enabled ?? 0,
      sourcesDisabled: s?.disabled ?? 0,
      sourcesFailing: s?.failing ?? 0,
    };
  } catch {
    /* corpus counters stay zeroed — dashboard still renders */
  }

  return Response.json({
    jobs,
    articlesByStatus,
    corpus,
    usage: summarizeUsage(24),
    fastTier: fastTierStatus(),
  });
}
