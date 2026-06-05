import { createServerClient } from '@/lib/supabase/server';
import supabase from '@/lib/db';

/**
 * Claim a guest conversation after the visitor signs up / logs in.
 *
 * Guest searches are persisted with `user_id = null` (see
 * `ensureChatExists` in `app/api/chat/runBackground.ts`).  Once the
 * visitor authenticates we re-own that chat so it shows up in their
 * history.  Only unowned chats can be claimed, so this cannot steal
 * another user's conversation.
 */
export const POST = async (
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const { id } = await params;

    const authClient = createServerClient(req);
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return Response.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { error } = await supabase
      .from('chats')
      .update({ user_id: user.id })
      .eq('id', id)
      .is('user_id', null);

    if (error) throw error;

    return Response.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error('Error claiming chat:', err);
    return Response.json({ message: 'An error has occurred.' }, { status: 500 });
  }
};
