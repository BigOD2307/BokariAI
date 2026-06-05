import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';
import { createDeck, listDecks } from '@/lib/learn/decks';

/**
 * Learn-mode decks. GET lists the user's decks; POST saves a deck from a
 * flashcard block (idempotent on the originating question, so re-saving the
 * same answer doesn't duplicate cards or reset review progress).
 */
const createSchema = z.object({
  sourceQuery: z.string().min(1, 'Question requise'),
  title: z.string().optional(),
  subject: z.string().nullable().optional(),
  cards: z
    .array(z.object({ front: z.string().min(1), back: z.string().min(1) }))
    .min(1, 'Au moins une fiche'),
});

export const GET = async (req: Request) => {
  const {
    data: { user },
  } = await createServerClient(req).auth.getUser();
  if (!user) return Response.json({ message: 'Unauthorized' }, { status: 401 });
  try {
    return Response.json({ decks: await listDecks(user.id) });
  } catch (err) {
    console.error('[Bokari Learn] listDecks:', err);
    return Response.json({ message: 'Erreur' }, { status: 500 });
  }
};

export const POST = async (req: Request) => {
  const {
    data: { user },
  } = await createServerClient(req).auth.getUser();
  if (!user) return Response.json({ message: 'Unauthorized' }, { status: 401 });
  try {
    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json(
        { message: parsed.error.issues[0].message },
        { status: 400 },
      );
    }
    const { sourceQuery, title, subject, cards } = parsed.data;
    const deckTitle = (title?.trim() || sourceQuery).slice(0, 80);
    const { deck, created } = await createDeck(user.id, {
      title: deckTitle,
      sourceQuery,
      subject: subject ?? null,
      cards,
    });
    return Response.json({ deck, created }, { status: created ? 201 : 200 });
  } catch (err) {
    console.error('[Bokari Learn] createDeck:', err);
    return Response.json({ message: 'Erreur' }, { status: 500 });
  }
};
