import { runJob } from '@/lib/scheduler/jobs';

/**
 * POST /api/internal/cron/[job]
 *
 * Manually fire a scheduled job (discover-daily | articles-rotate |
 * stats-weekly). Guarded by CRON_SECRET — pass it as `Authorization: Bearer
 * <secret>` or `?key=<secret>`. Useful for: testing without waiting for the
 * cron boundary, and as a host-crontab fallback if the in-process scheduler is
 * ever disabled.
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

const handler = async (
  req: Request,
  ctx: { params: Promise<{ job: string }> },
) => {
  if (!authorized(req)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { job } = await ctx.params;
  try {
    const summary = await runJob(job);
    return Response.json({ ok: true, summary, timestamp: new Date().toISOString() });
  } catch (err) {
    return Response.json(
      { ok: false, error: (err as Error)?.message ?? String(err) },
      { status: 400 },
    );
  }
};

export const POST = handler;
export const GET = handler;
