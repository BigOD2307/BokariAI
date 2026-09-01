import { and, asc, eq } from 'drizzle-orm';
import { getCaller } from '@/lib/auth/require';
import { pgDb, schema } from '@/lib/db/postgres/client';
import { mapChat, mapMessages } from '@/lib/supabase/mappers';

export const GET = async (
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const { id } = await params;

    const [chat] = await pgDb
      .select()
      .from(schema.chats)
      .where(eq(schema.chats.id, id))
      .limit(1);

    if (!chat) {
      return Response.json({ message: 'Chat not found' }, { status: 404 });
    }

    // Owned chats are private to their owner. Unowned guest chats
    // (user_id null) stay readable by anyone holding the 40-byte id.
    const caller = await getCaller(req);
    if (chat.userId && (!caller || chat.userId !== caller.userId)) {
      return Response.json({ message: 'Chat not found' }, { status: 404 });
    }

    const messages = await pgDb
      .select()
      .from(schema.messages)
      .where(eq(schema.messages.chatId, id))
      .orderBy(asc(schema.messages.id));

    return Response.json(
      {
        chat: mapChat(chat),
        messages: mapMessages(messages),
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

    // Require an authenticated owner — never delete a chat for an
    // unauthenticated caller, and only the owner may delete their chat.
    const caller = await getCaller(req);
    if (!caller) {
      return Response.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const [chat] = await pgDb
      .select({ userId: schema.chats.userId })
      .from(schema.chats)
      .where(eq(schema.chats.id, id))
      .limit(1);

    // 404 (not 403) when missing or not owned, so we don't leak existence.
    if (!chat || chat.userId !== caller.userId) {
      return Response.json({ message: 'Chat not found' }, { status: 404 });
    }

    await pgDb.delete(schema.messages).where(eq(schema.messages.chatId, id));
    await pgDb
      .delete(schema.chats)
      .where(and(eq(schema.chats.id, id), eq(schema.chats.userId, caller.userId)));

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
