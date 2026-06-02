/**
 * POST /api/feedback
 *
 * Phase 8: capture user feedback (👍 / 👎 / optional comment) for a given
 * assistant message, plus the full conversation context (query, response,
 * cited sources, model metadata).  The captured context is the gold — it's
 * what we'll use later for fine-tuning and to upgrade the synthetic
 * `deriveRelevance` grader to real human labels.
 *
 * Idempotency: re-submitting with the same `messageId` and rating (≠ 0)
 * upserts the existing row (the `idx_feedback_message_user` partial unique
 * index enforces one active row per message/user pair).  Submitting with
 * `rating: 0` deletes the row.
 *
 * Auth: any client can POST (rate-limited at the edge in production).  We
 * always use the service-role client, then optionally stamp the `user_id`
 * from the auth cookie if present.  RLS still keeps the row private on
 * read because direct browser reads go through the user-scoped client.
 */
import { z } from 'zod';
import supabase from '@/lib/db';
import { createServerClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const sourceSchema = z.object({
  url: z.string().min(1),
  title: z.string(),
  domain: z.string().optional(),
  source: z.string().optional(),
});

const metadataSchema = z.object({
  chatProvider: z.string(),
  chatModel: z.string(),
  embeddingProvider: z.string(),
  embeddingModel: z.string(),
  optimizationMode: z.string(),
  researchStepCount: z.number().int().nonnegative(),
  sourceCount: z.number().int().nonnegative(),
  bokariCitationCount: z.number().int().nonnegative(),
  hasBokariCitations: z.boolean(),
  latencyMs: z.number().nullable(),
  locale: z.string(),
  userAgent: z.string().max(512),
});

const capturedSchema = z.object({
  query: z.string(),
  response: z.string(),
  sources: z.array(sourceSchema).max(50),
  metadata: metadataSchema,
});

const bodySchema = z.object({
  messageId: z.string().min(1).max(256),
  chatId: z.string().max(256).nullable().optional(),
  rating: z.number().int().refine((n) => n === -1 || n === 0 || n === 1, {
    message: 'rating must be -1, 0, or 1',
  }),
  comment: z.string().max(2000).nullable().optional(),
  captured: capturedSchema,
});

const safeValidateBody = (data: unknown) => {
  const result = bodySchema.safeParse(data);
  if (!result.success) {
    return {
      success: false as const,
      error: result.error.issues.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    };
  }
  return { success: true as const, data: result.data };
};

const trimComment = (raw: string | null | undefined): string | null => {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, 2000);
};

export const POST = async (req: Request) => {
  try {
    const raw = await req.json();
    const parsed = safeValidateBody(raw);
    if (!parsed.success) {
      return Response.json(
        { message: 'Invalid request body', error: parsed.error },
        { status: 400 },
      );
    }

    const { messageId, chatId, rating, captured } = parsed.data;
    const comment = trimComment(parsed.data.comment);

    // Try to attach the auth user (nullable — anonymous visitors still
    // get to leave feedback, and the row will be user_id = NULL).
    let userId: string | null = null;
    try {
      const authClient = createServerClient(req);
      const {
        data: { user },
      } = await authClient.auth.getUser();
      userId = user?.id ?? null;
    } catch {
      userId = null;
    }

    // rating: 0 means "the user cleared their previous feedback".  We
    // delete any active row for this (messageId, userId) instead of
    // inserting a tombstone — keeps the table clean and the export
    // script simple.
    if (rating === 0) {
      if (userId) {
        await supabase
          .from('feedback')
          .delete()
          .eq('message_id', messageId)
          .eq('user_id', userId);
      } else {
        await supabase
          .from('feedback')
          .delete()
          .eq('message_id', messageId)
          .is('user_id', null);
      }
      return Response.json({ ok: true, deleted: true });
    }

    // Upsert: if the user toggles thumbs multiple times, we keep a
    // single row per (messageId, userId).  Anon rows are best-effort
    // (we tolerate duplicates since the unique index treats NULL
    // user_ids as distinct).
    const row = {
      message_id: messageId,
      chat_id: chatId ?? null,
      user_id: userId,
      rating,
      comment,
      captured,
    };

    if (userId) {
      const { data, error } = await supabase
        .from('feedback')
        .upsert(row, { onConflict: 'message_id,user_id' })
        .select('id')
        .single();

      if (error) {
        console.error('[feedback] upsert error:', error.message);
        return Response.json(
          { message: 'Failed to save feedback' },
          { status: 500 },
        );
      }
      return Response.json({ ok: true, id: data?.id });
    }

    // Anon insert: just append.  The unique index won't catch this since
    // user_id is NULL — that's intentional, we don't want to drop anon
    // feedback because someone else already submitted on the same
    // message.  Rate-limit at the edge if abuse becomes a problem.
    const { data, error } = await supabase
      .from('feedback')
      .insert(row)
      .select('id')
      .single();

    if (error) {
      console.error('[feedback] insert error:', error.message);
      return Response.json(
        { message: 'Failed to save feedback' },
        { status: 500 },
      );
    }
    return Response.json({ ok: true, id: data?.id });
  } catch (err) {
    console.error('[feedback] unexpected error:', err);
    return Response.json(
      { message: 'Failed to save feedback' },
      { status: 500 },
    );
  }
};
