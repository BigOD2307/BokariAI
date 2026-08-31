import { requireAdmin, HttpError } from '@/lib/auth/require';
import { listArticles, type ArticleStatus } from '@/lib/blog/store';
import { runArticlesRotation } from '@/lib/scheduler/jobs';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** GET /api/admin/articles?status=draft — list articles for the review queue. */
export async function GET(req: Request) {
  try {
    await requireAdmin(req);
  } catch (err) {
    return err instanceof HttpError ? err.toResponse() : Response.json({}, { status: 404 });
  }

  const status = (new URL(req.url).searchParams.get('status') || 'draft') as ArticleStatus;
  const articles = await listArticles({ status, limit: 100 });
  return Response.json({ articles });
}

/**
 * POST /api/admin/articles  { category }
 * Generate a draft on demand for a category (or the next in rotation if omitted).
 */
export async function POST(req: Request) {
  try {
    await requireAdmin(req);
  } catch (err) {
    return err instanceof HttpError ? err.toResponse() : Response.json({}, { status: 404 });
  }

  let category: string | undefined;
  try {
    const body = await req.json();
    category = typeof body?.category === 'string' ? body.category : undefined;
  } catch {
    /* no body — use rotation */
  }

  const summary = await runArticlesRotation(category);
  return Response.json({ ok: true, summary });
}
