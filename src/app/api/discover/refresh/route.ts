import { runDiscoverRefresh } from '@/lib/discover/refreshJob';

/**
 * POST /api/discover/refresh  (GET also accepted for cron / curl convenience)
 *
 * Delegates to the shared `runDiscoverRefresh` core (see refreshJob.ts), which
 * is also called directly by the daily scheduler. `?topic=` refreshes a single
 * topic; omit it to refresh all.
 *
 * Guarded by CRON_SECRET (Authorization: Bearer <secret> or ?key=<secret>):
 * this triggers paid embeddings + Supabase writes, so it must not be public.
 * The in-process scheduler calls runDiscoverRefresh() directly, so gating the
 * HTTP route does not affect the autonomous daily refresh.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // closed by default until a secret is set
  const auth = req.headers.get('authorization');
  const bearer = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  const key = bearer ?? new URL(req.url).searchParams.get('key');
  return key === secret;
}

const handler = async (req: Request) => {
  if (!authorized(req)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const params = new URL(req.url).searchParams;
    const singleTopic = params.get('topic');
    const summary = await runDiscoverRefresh(singleTopic);
    const status = summary.success || summary.totalInserted > 0 ? 200 : 500;
    return Response.json({ ...summary, timestamp: new Date().toISOString() }, { status });
  } catch (err) {
    console.error('[Discover Refresh] Fatal error:', err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
};

export const POST = handler;
export const GET = handler;
