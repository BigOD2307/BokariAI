import { createServerClient } from '@/lib/supabase/server';
import { getDueCards } from '@/lib/learn/decks';

/** The user's cards due now (dueAt <= now), oldest-first, capped — the
 *  /learn daily-review queue. */
export const GET = async (req: Request) => {
  const {
    data: { user },
  } = await createServerClient(req).auth.getUser();
  if (!user) return Response.json({ message: 'Unauthorized' }, { status: 401 });
  try {
    return Response.json({ cards: await getDueCards(user.id) });
  } catch (err) {
    console.error('[Bokari Learn] getDueCards:', err);
    return Response.json({ message: 'Erreur' }, { status: 500 });
  }
};
