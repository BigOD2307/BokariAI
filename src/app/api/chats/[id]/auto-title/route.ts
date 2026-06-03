import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';
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

    const supabase = createServerClient(request);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { data: chat, error: chatError } = await supabase
      .from('chats')
      .select('id, title')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (chatError) throw chatError;
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

    const { data, error } = await supabase
      .from('chats')
      .update({
        title: result.title,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select('id, title, updated_at')
      .single();

    if (error) throw error;

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
