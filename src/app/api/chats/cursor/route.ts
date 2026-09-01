import { NextResponse } from 'next/server';
import { z } from 'zod';
import { and, desc, eq, lt, sql } from 'drizzle-orm';
import { getCaller } from '@/lib/auth/require';
import { pgDb, schema } from '@/lib/db/postgres/client';
import { mapChats } from '@/lib/supabase/mappers';

const QuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  q: z.string().optional(),
});

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const caller = await getCaller(request);

    if (!caller) {
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

    const conditions = [eq(schema.chats.userId, caller.userId)];
    if (cursor) conditions.push(lt(schema.chats.updatedAt, new Date(cursor)));
    // Matches the GIN index idx_chats_title_fr (schema.ts), which is built on
    // this exact expression, so this scan uses the index.
    if (q && q.trim().length >= 2) {
      conditions.push(
        sql`to_tsvector('french', ${schema.chats.title}) @@ websearch_to_tsquery('french', ${q.trim()})`,
      );
    }

    const rows = await pgDb
      .select({
        id: schema.chats.id,
        title: schema.chats.title,
        createdAt: schema.chats.createdAt,
        updatedAt: schema.chats.updatedAt,
      })
      .from(schema.chats)
      .where(and(...conditions))
      .orderBy(desc(schema.chats.updatedAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const slice = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? slice[slice.length - 1].updatedAt.toISOString() : null;

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
