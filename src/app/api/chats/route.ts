import { desc, eq } from 'drizzle-orm';
import { getCaller } from '@/lib/auth/require';
import { pgDb, schema } from '@/lib/db/postgres/client';
import { mapChats } from '@/lib/supabase/mappers';

export const GET = async (req: Request) => {
  try {
    const caller = await getCaller(req);

    if (!caller) {
      return Response.json({ chats: [] }, { status: 200 });
    }

    const chats = await pgDb
      .select()
      .from(schema.chats)
      .where(eq(schema.chats.userId, caller.userId))
      .orderBy(desc(schema.chats.createdAt));

    return Response.json({ chats: mapChats(chats) }, { status: 200 });
  } catch (err) {
    console.error('Error in getting chats: ', err);
    return Response.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};
