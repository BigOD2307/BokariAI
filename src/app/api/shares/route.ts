import { NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { getCaller } from '@/lib/auth/require';
import { pgDb, schema } from '@/lib/db/postgres/client';
import { createShare, getShareByChat } from '@/lib/auth/shares';

const Body = z.object({
  chatId: z.string().min(1).max(64),
  isIndexed: z.boolean().optional(),
  anonymousAuthor: z.boolean().optional(),
  expiresInDays: z.number().int().min(1).max(365).optional(),
});

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let body;
  try {
    body = Body.parse(await request.json());
  } catch {
    return NextResponse.json({ message: 'Invalid body' }, { status: 400 });
  }

  const caller = await getCaller(request);
  if (!caller) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  let chat: { id: string; userId: string | null } | undefined;
  try {
    [chat] = await pgDb
      .select({ id: schema.chats.id, userId: schema.chats.userId })
      .from(schema.chats)
      .where(eq(schema.chats.id, body.chatId))
      .limit(1);
  } catch {
    return NextResponse.json({ message: 'Internal error' }, { status: 500 });
  }
  // 404 (not 403) when unowned — same "don't confirm existence to a
  // non-owner" pattern as the rest of the app (see chats/[id]/route.ts).
  if (!chat || chat.userId !== caller.userId) {
    return NextResponse.json({ message: 'Chat not found' }, { status: 404 });
  }

  const existing = await getShareByChat(body.chatId);
  if (existing) {
    return NextResponse.json(
      {
        share: existing,
        url: `${getBaseUrl(request)}/p/${existing.slug}`,
        alreadyShared: true,
      },
      { status: 200 },
    );
  }

  try {
    const share = await createShare(caller.userId, body);
    return NextResponse.json(
      {
        share,
        url: `${getBaseUrl(request)}/p/${share.slug}`,
        alreadyShared: false,
      },
      { status: 201 },
    );
  } catch (err) {
    console.error('[api/shares] createShare error:', err);
    return NextResponse.json(
      { message: 'Could not create share' },
      { status: 500 },
    );
  }
}

function getBaseUrl(request: Request): string {
  const env = process.env.NEXT_PUBLIC_APP_URL;
  if (env) return env.replace(/\/$/, '');
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}
