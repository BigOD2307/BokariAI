import { createServerClient } from '@/lib/supabase/server';
import { mapChat, mapMessages } from '@/lib/supabase/mappers';

export const GET = async (
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const { id } = await params;
    const supabase = createServerClient(req);

    const { data: chat, error: chatError } = await supabase
      .from('chats')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (chatError) throw chatError;
    if (!chat) {
      return Response.json({ message: 'Chat not found' }, { status: 404 });
    }

    const { data: messages, error: msgError } = await supabase
      .from('messages')
      .select('*')
      .eq('chat_id', id)
      .order('id', { ascending: true });

    if (msgError) throw msgError;

    return Response.json(
      {
        chat: mapChat(chat),
        messages: mapMessages(messages || []),
      },
      { status: 200 },
    );
  } catch (err) {
    console.error('Error in getting chat by id: ', err);
    return Response.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};

export const DELETE = async (
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const { id } = await params;
    const supabase = createServerClient(req);

    await supabase.from('messages').delete().eq('chat_id', id);
    const { error } = await supabase.from('chats').delete().eq('id', id);

    if (error) throw error;

    return Response.json(
      { message: 'Chat deleted successfully' },
      { status: 200 },
    );
  } catch (err) {
    console.error('Error in deleting chat by id: ', err);
    return Response.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};
