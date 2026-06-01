import { createServerClient } from '@/lib/supabase/server';
import { mapChats } from '@/lib/supabase/mappers';

export const GET = async (req: Request) => {
  try {
    const supabase = createServerClient(req);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ chats: [] }, { status: 200 });
    }

    const { data: chats, error } = await supabase
      .from('chats')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return Response.json({ chats: mapChats(chats || []) }, { status: 200 });
  } catch (err) {
    console.error('Error in getting chats: ', err);
    return Response.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};
