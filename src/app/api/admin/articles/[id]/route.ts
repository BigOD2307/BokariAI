import { requireAdmin } from '@/lib/auth/admin';
import {
  getArticleById,
  setArticleStatus,
  updateArticleContent,
} from '@/lib/blog/store';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/admin/articles/[id]
 *
 * Body:
 *   { action: 'publish' | 'reject' | 'unpublish' }   — change status, or
 *   { title?, excerpt?, body?, category? }            — edit content (+ optional action)
 */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin(req);
  if (!admin) return Response.json({ error: 'forbidden' }, { status: 403 });

  const { id } = await ctx.params;
  const existing = await getArticleById(id);
  if (!existing) return Response.json({ error: 'not found' }, { status: 404 });

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'invalid body' }, { status: 400 });
  }

  // Content edits first.
  const patch: Record<string, string> = {};
  for (const f of ['title', 'excerpt', 'body', 'category'] as const) {
    if (typeof body[f] === 'string' && (body[f] as string).trim()) {
      patch[f] = (body[f] as string).trim();
    }
  }
  if (Object.keys(patch).length > 0) {
    await updateArticleContent(id, patch);
  }

  // Status action.
  const action = body.action as string | undefined;
  if (action === 'publish') await setArticleStatus(id, 'published');
  else if (action === 'reject') await setArticleStatus(id, 'rejected');
  else if (action === 'unpublish') await setArticleStatus(id, 'draft');

  const updated = await getArticleById(id);
  return Response.json({ ok: true, article: updated });
}

/** GET single article (admin) — full row incl. draft body. */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin(req);
  if (!admin) return Response.json({ error: 'forbidden' }, { status: 403 });
  const { id } = await ctx.params;
  const article = await getArticleById(id);
  if (!article) return Response.json({ error: 'not found' }, { status: 404 });
  return Response.json({ article });
}
