import { z } from 'zod';
import { getCaller } from '@/lib/auth/require';
import { persistReview } from '@/lib/learn/decks';

/** Grade a flashcard review: maps the grade → SM-2 → next due date. */
const reviewSchema = z.object({
  grade: z.enum(['again', 'hard', 'good', 'easy']),
});

export const POST = async (
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id } = await params;
  const caller = await getCaller(req);
  if (!caller) return Response.json({ message: 'Unauthorized' }, { status: 401 });
  try {
    const parsed = reviewSchema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json({ message: 'Note invalide' }, { status: 400 });
    }
    const result = await persistReview(caller.userId, id, parsed.data.grade);
    if (!result) {
      return Response.json({ message: 'Carte introuvable' }, { status: 404 });
    }
    return Response.json(result);
  } catch (err) {
    console.error('[Bokari Learn] persistReview:', err);
    return Response.json({ message: 'Erreur' }, { status: 500 });
  }
};
