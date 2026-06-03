import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';

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

    const supabase = createServerClient(request);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('chats')
      .update({
        title: body.title,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select('id, title, updated_at')
      .single();

    if (error) throw error;
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
