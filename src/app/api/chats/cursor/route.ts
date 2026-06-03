import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';
import { mapChats } from '@/lib/supabase/mappers';

const QuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  q: z.string().optional(),
});

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const supabase = createServerClient(request);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ chats: [], hasMore: false }, { status: 200 });
    }

    const url = new URL(request.url);
    const parsed = QuerySchema.safeParse({
      cursor: url.searchParams.get('cursor') ?? undefined,
      limit: url.searchParams.get('limit') ?? undefined,
      q: url.searchParams.get('q') ?? undefined,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Invalid query parameters' },
        { status: 400 },
      );
    }
    const { cursor, limit, q } = parsed.data;

    let query = supabase
      .from('chats')
      .select('id, title, created_at, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(limit + 1);

    if (cursor) {
      query = query.lt('updated_at', cursor);
    }
    if (q && q.trim().length >= 2) {
      query = query.textSearch('title', q.trim(), {
        type: 'websearch',
        config: 'french',
      });
    }

    const { data, error } = await query;
    if (error) throw error;

    const rows = data ?? [];
    const hasMore = rows.length > limit;
    const slice = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? slice[slice.length - 1].updated_at : null;

    return NextResponse.json(
      {
        chats: mapChats(slice),
        hasMore,
        nextCursor,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error('Error in cursor-paginated chats: ', err);
    return NextResponse.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
}
