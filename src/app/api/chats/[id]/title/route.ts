import { NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { getCaller } from '@/lib/auth/require';
import { pgDb, schema } from '@/lib/db/postgres/client';

const Body = z.object({
  title: z.string().min(1).max(200).trim(),
});

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    let body;
    try {
      body = Body.parse(await request.json());
    } catch {
      return NextResponse.json(
        { message: 'Invalid title' },
        { status: 400 },
      );
    }

    const caller = await getCaller(request);
    if (!caller) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const [data] = await pgDb
      .update(schema.chats)
      .set({ title: body.title, updatedAt: new Date() })
      .where(and(eq(schema.chats.id, id), eq(schema.chats.userId, caller.userId)))
      .returning({
        id: schema.chats.id,
        title: schema.chats.title,
        updatedAt: schema.chats.updatedAt,
      });

    if (!data) {
      return NextResponse.json({ message: 'Chat not found' }, { status: 404 });
    }

    return NextResponse.json({ chat: data }, { status: 200 });
  } catch (err) {
    console.error('Error renaming chat: ', err);
    return NextResponse.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
}
