import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getShareBySlug } from '@/lib/auth/shares';
import { pgDb, schema } from '@/lib/db/postgres/client';
import { mapChat, mapMessages } from '@/lib/supabase/mappers';
import { incrementViewCount } from '@/lib/auth/shares';
import type { PublicChatView } from '@/lib/types/shares';

export const dynamic = 'force-dynamic';
export const revalidate = 3600;

const stripAssistantText = (raw: string): string => {
  if (!raw) return '';
  return raw
    .replace(/\!\[.*?\]\(.*?\)/g, '')
    .replace(/<ChartSpec>[\s\S]*?<\/ChartSpec>/g, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/<source>[\s\S]*?<\/source>/g, '')
    // C7: citations are now stable ids ([S1], [S3]…), not positions.
    .replace(/\[S\d{1,3}\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

const buildSources = (messages: any[]): PublicChatView['sources'] => {
  const sources = new Map<string, { title: string; url: string; snippet?: string }>();
  for (const msg of messages) {
    for (const block of msg.responseBlocks ?? []) {
      if (block?.type === 'source' && block?.source?.metadata_url) {
        const url = block.source.metadata_url;
        if (!sources.has(url)) {
          sources.set(url, {
            url,
            title: block.source.metadata_title ?? url,
            snippet: block.source.text?.slice(0, 200),
          });
        }
      }
    }
  }
  return Array.from(sources.values()).slice(0, 10);
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const share = await getShareBySlug(slug);
  if (!share) {
    return NextResponse.json({ message: 'Not found' }, { status: 404 });
  }

  let chat: typeof schema.chats.$inferSelect | undefined;
  let messages: (typeof schema.messages.$inferSelect)[];
  try {
    [chat] = await pgDb.select().from(schema.chats).where(eq(schema.chats.id, share.chatId)).limit(1);
    if (!chat) return NextResponse.json({ message: 'Not found' }, { status: 404 });
    messages = await pgDb
      .select()
      .from(schema.messages)
      .where(eq(schema.messages.chatId, share.chatId))
      .orderBy(schema.messages.id);
  } catch {
    return NextResponse.json({ message: 'Internal error' }, { status: 500 });
  }

  const mappedChat = mapChat(chat);
  const mappedMessages = mapMessages(messages);

  const firstUserMessage = mappedMessages.find((m: any) => m.role === 'user') ?? null;
  const assistantMessage = mappedMessages.find((m: any) => m.role === 'assistant') ?? null;
  const answerBlocks = (assistantMessage?.responseBlocks ?? []) as any[];
  const answerText = answerBlocks
    .filter((b) => b?.type === 'text' || b?.type === 'p')
    .map((b) => b?.text ?? b?.content ?? '')
    .join(' ')
    .trim() || stripAssistantText(assistantMessage?.content ?? '');

  const sources = buildSources(mappedMessages);

  let authorName = 'Utilisateur Bokari';
  if (!share.anonymousAuthor) {
    // `profiles` no longer exists — `users` absorbed it, same `name` column.
    const [author] = await pgDb
      .select({ name: schema.users.name })
      .from(schema.users)
      .where(eq(schema.users.id, share.userId))
      .limit(1);
    authorName = author?.name ?? authorName;
  }

  incrementViewCount(share.id).catch(() => undefined);

  const response: PublicChatView = {
    share: {
      id: share.id,
      // chatId/userId deliberately omitted: they are internal ids the client
      // needs nowhere, and publishing them lets a visitor probe /api/chats/[id]
      // and re-derive another user's memory context (BUG-15).
      slug: share.slug,
      isIndexed: share.isIndexed,
      anonymousAuthor: share.anonymousAuthor,
      viewCount: share.viewCount,
      createdAt: share.createdAt,
      expiresAt: share.expiresAt,
      revokedAt: share.revokedAt,
    },
    chat: {
      // No `id` here: it IS the private chatId (same row), which must not
      // reach an unauthenticated visitor — see the note on `share` above.
      title: mappedChat.title,
      createdAt: mappedChat.createdAt,
    },
    author: {
      name: authorName,
      isAnonymous: share.anonymousAuthor,
    },
    firstUserMessage: firstUserMessage
      ? { content: (firstUserMessage as any).content ?? (firstUserMessage as any).query ?? '' }
      : null,
    answer: answerText,
    sources,
  };

  return NextResponse.json(response, {
    status: 200,
    headers: {
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
