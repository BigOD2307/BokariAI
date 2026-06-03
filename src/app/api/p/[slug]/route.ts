import { NextResponse } from 'next/server';
import { getShareBySlug } from '@/lib/auth/shares';
import { createServerClient } from '@/lib/supabase/server';
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
    .replace(/\[\d+\]/g, '')
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

  const supabase = createServerClient(request);
  const { data: chat, error: chatError } = await supabase
    .from('chats')
    .select('*')
    .eq('id', share.chatId)
    .maybeSingle();
  if (chatError || !chat) {
    return NextResponse.json({ message: 'Not found' }, { status: 404 });
  }

  const { data: messages, error: msgError } = await supabase
    .from('messages')
    .select('*')
    .eq('chat_id', share.chatId)
    .order('id', { ascending: true });
  if (msgError) {
    return NextResponse.json({ message: 'Internal error' }, { status: 500 });
  }

  const mappedChat = mapChat(chat);
  const mappedMessages = mapMessages(messages || []);

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
    const { data: profile } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', share.userId)
      .maybeSingle();
    authorName = profile?.name ?? authorName;
  }

  incrementViewCount(share.id).catch(() => undefined);

  const response: PublicChatView = {
    share: {
      id: share.id,
      chatId: share.chatId,
      userId: share.userId,
      slug: share.slug,
      isIndexed: share.isIndexed,
      anonymousAuthor: share.anonymousAuthor,
      viewCount: share.viewCount,
      createdAt: share.createdAt,
      expiresAt: share.expiresAt,
      revokedAt: share.revokedAt,
    },
    chat: {
      id: mappedChat.id,
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
