import { getCaller } from '@/lib/auth/require';
import { getDueCards } from '@/lib/learn/decks';

/** The user's cards due now (dueAt <= now), oldest-first, capped — the
 *  /learn daily-review queue. */
export const GET = async (req: Request) => {
  const caller = await getCaller(req);
  if (!caller) return Response.json({ message: 'Unauthorized' }, { status: 401 });
  try {
    return Response.json({ cards: await getDueCards(caller.userId) });
  } catch (err) {
    console.error('[Bokari Learn] getDueCards:', err);
    return Response.json({ message: 'Erreur' }, { status: 500 });
  }
};
