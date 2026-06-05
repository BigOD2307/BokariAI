/**
 * @module app/api/chat/cacheHit
 * @description Cache fast-path for the chat SSE stream.
 *
 * On a semantic-cache hit we don't need to do any agent work —
 * we just emit a single text block + researchComplete + messageEnd
 * and close the stream.  This drops the response from "seconds"
 * to "single tick" for any repeat query.
 *
 * It ALSO persists the conversation (chat row + completed message) so a
 * cache-hit answer still shows up — and opens fully — in the user's history,
 * exactly like the live agent path. (It used to skip this, so repeat queries
 * silently never appeared in history.)
 */
import { startTimer, logStage } from '@/lib/observability/latence';
import { recordTiming } from '@/lib/observability/ttfb';
import { tryGetCachedResponse } from '@/lib/cache/semantic';
import { embedOne } from '@/lib/ai/gateway';
import supabase from '@/lib/db';

type Writer = (line: string) => Promise<void>;

/**
 * Look up the query in the cache.  On hit, write the cached response to the
 * stream and return the response TEXT (so the caller can persist it).  On miss,
 * return null.
 */
export const tryServeCacheHit = async (
  query: string,
  mode: 'speed' | 'balanced' | 'quality' | 'learn',
  safeWrite: Writer,
  tTotal: () => number,
): Promise<string | null> => {
  const tCache = startTimer();
  let cacheHit: Awaited<ReturnType<typeof tryGetCachedResponse>> = null;
  try {
    const embeddingVec = await embedOne(query);
    cacheHit = await tryGetCachedResponse(query, async () => embeddingVec);
  } catch (err) {
    console.warn('[Bokari] cache lookup failed; falling back to live:', err);
  }
  logStage('chat.cache_lookup', tCache(), { hit: cacheHit?.hitType ?? 'miss' });
  recordTiming('chat.cache_lookup', tCache());

  if (!cacheHit) return null;

  const tCacheRespond = startTimer();
  const block = {
    id: crypto.randomUUID(),
    type: 'text',
    data: cacheHit.response,
  };
  await safeWrite(JSON.stringify({ type: 'block', block }));
  await safeWrite(JSON.stringify({ type: 'researchComplete' }));
  await safeWrite(JSON.stringify({ type: 'messageEnd' }));
  logStage('chat.cache_serve', tCacheRespond(), { hit: cacheHit.hitType, mode });
  recordTiming('chat.cache_serve', tCacheRespond());
  logStage('chat.total', tTotal(), { ok: true, cache: cacheHit.hitType });
  return cacheHit.response;
};

/**
 * Persist a cache-hit conversation (chat row + completed message carrying the
 * cached answer) so it appears — and opens with its content — in the user's
 * history. Best-effort: never throws into the request path.
 */
export const persistCacheHit = async (input: {
  chatId: string;
  messageId: string;
  query: string;
  sources: string[];
  fileIds: string[];
  userId?: string;
  responseText: string;
}): Promise<void> => {
  try {
    const { data: exists } = await supabase
      .from('chats')
      .select('id')
      .eq('id', input.chatId)
      .maybeSingle();
    if (!exists) {
      await supabase.from('chats').insert({
        id: input.chatId,
        user_id: input.userId || null,
        title: input.query,
        sources: input.sources || [],
        files: input.fileIds.map((id) => ({ fileId: id, name: 'Uploaded File' })),
      });
    }

    const responseBlocks = [
      { id: crypto.randomUUID(), type: 'text', data: input.responseText },
    ];

    const { data: msgExists } = await supabase
      .from('messages')
      .select('id')
      .eq('chat_id', input.chatId)
      .eq('message_id', input.messageId)
      .maybeSingle();

    if (!msgExists) {
      await supabase.from('messages').insert({
        chat_id: input.chatId,
        message_id: input.messageId,
        query: input.query,
        created_at: new Date().toISOString(),
        status: 'completed',
        response_blocks: responseBlocks,
      });
    } else {
      await supabase
        .from('messages')
        .update({ status: 'completed', response_blocks: responseBlocks })
        .eq('chat_id', input.chatId)
        .eq('message_id', input.messageId);
    }
  } catch (err) {
    console.warn('[Bokari] cache-hit persist failed:', err);
  }
};
