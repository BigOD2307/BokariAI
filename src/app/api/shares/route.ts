import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';
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

  const supabase = createServerClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { data: chat, error: chatError } = await supabase
    .from('chats')
    .select('id, user_id')
    .eq('id', body.chatId)
    .maybeSingle();
  if (chatError) {
    return NextResponse.json({ message: 'Internal error' }, { status: 500 });
  }
  if (!chat) {
    return NextResponse.json({ message: 'Chat not found' }, { status: 404 });
  }
  if (chat.user_id !== user.id) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
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
    const share = await createShare(user.id, body);
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
