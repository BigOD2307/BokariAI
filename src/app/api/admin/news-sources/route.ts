/**
 * Admin management of the news corpus sources (C9).
 *  GET                — list sources with fetch health.
 *  PATCH { id, ... }  — operator edits: enable/disable, re-arm failures.
 * Writes here are deliberate operator decisions; the registry seed never
 * overwrites them (see ensureSourcesSeeded in src/lib/news/crawl.ts).
 */
import { requireAdmin, HttpError } from '@/lib/auth/require';
import { pgDb } from '@/lib/db/postgres/client';
import { newsArticles, newsSources } from '@/lib/db/postgres/schema';
import { desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    await requireAdmin(req);
  } catch (err) {
    return err instanceof HttpError
      ? err.toResponse()
      : Response.json({}, { status: 404 });
  }

  const rows = await pgDb
    .select({
      id: newsSources.id,
      domain: newsSources.domain,
      name: newsSources.name,
      country: newsSources.country,
      tier: newsSources.tier,
      isStateMedia: newsSources.isStateMedia,
      isCertified: newsSources.isCertified,
      enabled: newsSources.enabled,
      lastFetchAt: newsSources.lastFetchAt,
      lastFetchStatus: newsSources.lastFetchStatus,
      consecutiveFailures: newsSources.consecutiveFailures,
      articleCount: sql<number>`(select count(*)::int from ${newsArticles} where ${newsArticles.sourceId} = ${newsSources.id})`,
    })
    .from(newsSources)
    .orderBy(desc(newsSources.enabled), newsSources.tier, newsSources.name);

  return Response.json({ sources: rows });
}

const patchSchema = z.object({
  id: z.number().int().positive(),
  enabled: z.boolean().optional(),
  /** Re-arm a disabled source: clear the failure counter and re-enable. */
  rearm: z.boolean().optional(),
});

export async function PATCH(req: Request) {
  try {
    await requireAdmin(req);
  } catch (err) {
    return err instanceof HttpError
      ? err.toResponse()
      : Response.json({}, { status: 404 });
  }

  let body: z.infer<typeof patchSchema>;
  try {
    body = patchSchema.parse(await req.json());
  } catch {
    return Response.json({ error: 'INVALID_BODY' }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (body.enabled !== undefined) patch.enabled = body.enabled;
  if (body.rearm) {
    patch.consecutiveFailures = 0;
    patch.enabled = true;
  }
  if (Object.keys(patch).length === 0) {
    return Response.json({ error: 'NOTHING_TO_UPDATE' }, { status: 400 });
  }

  await pgDb.update(newsSources).set(patch).where(eq(newsSources.id, body.id));
  return Response.json({ ok: true });
}
