import { runDiscoverRefresh } from '@/lib/discover/refreshJob';

/**
 * POST /api/discover/refresh  (GET also accepted for cron / curl convenience)
 *
 * Delegates to the shared `runDiscoverRefresh` core (see refreshJob.ts), which
 * is also called directly by the daily scheduler. `?topic=` refreshes a single
 * topic; omit it to refresh all.
 */
const handler = async (req: Request) => {
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
