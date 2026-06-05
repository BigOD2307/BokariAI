import { createServerClient } from '@/lib/supabase/server';
import { getDeck } from '@/lib/learn/decks';

/** A single deck with its cards (owner-scoped; 404 if not owned). */
export const GET = async (
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id } = await params;
  const {
    data: { user },
  } = await createServerClient(req).auth.getUser();
  if (!user) return Response.json({ message: 'Unauthorized' }, { status: 401 });
  try {
    const result = await getDeck(user.id, id);
    if (!result) return Response.json({ message: 'Introuvable' }, { status: 404 });
    return Response.json(result);
  } catch (err) {
    console.error('[Bokari Learn] getDeck:', err);
    return Response.json({ message: 'Erreur' }, { status: 500 });
  }
};
