import { NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { getCaller } from '@/lib/auth/require';
import { pgDb, schema } from '@/lib/db/postgres/client';
import { generateTitle } from '@/lib/agents/title';

const Body = z.object({
  firstMessage: z.string().min(1).max(2000),
});

export const dynamic = 'force-dynamic';

export async function POST(
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
        { message: 'firstMessage required' },
        { status: 400 },
      );
    }

    const caller = await getCaller(request);
    if (!caller) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const [chat] = await pgDb
      .select({ id: schema.chats.id, title: schema.chats.title })
      .from(schema.chats)
      .where(and(eq(schema.chats.id, id), eq(schema.chats.userId, caller.userId)))
      .limit(1);

    if (!chat) {
      return NextResponse.json({ message: 'Chat not found' }, { status: 404 });
    }

    if (chat.title && chat.title !== 'Nouvelle conversation' && !chat.title.startsWith('...')) {
      return NextResponse.json(
        { message: 'Chat already has a title', skipped: true },
        { status: 200 },
      );
    }

    const result = await generateTitle(body.firstMessage);

    const [data] = await pgDb
      .update(schema.chats)
      .set({ title: result.title, updatedAt: new Date() })
      .where(and(eq(schema.chats.id, id), eq(schema.chats.userId, caller.userId)))
      .returning({
        id: schema.chats.id,
        title: schema.chats.title,
        updatedAt: schema.chats.updatedAt,
      });

    return NextResponse.json(
      { chat: data, model: result.model, latencyMs: result.latencyMs },
      { status: 200 },
    );
  } catch (err) {
    console.error('Error auto-titling chat: ', err);
    return NextResponse.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
}
