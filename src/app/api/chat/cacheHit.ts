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
import { tryGetCachedResponse, type CacheScope } from '@/lib/cache/semantic';
import { embedOne } from '@/lib/ai/gateway';
import supabase from '@/lib/db';
import { assertChatAccess } from '@/lib/auth/ownership';

type Writer = (line: string) => Promise<void>;

export type CacheHitResult = { text: string; sources: unknown[] };

/**
 * Look up the query in the cache.  On hit, write the cached response (text +
 * its sources, so `[n]` citations resolve — BUG-25) to the stream and return
 * it so the caller can persist it.  On miss, return null.
 */
export const tryServeCacheHit = async (
  query: string,
  scope: CacheScope,
  safeWrite: Writer,
  tTotal: () => number,
): Promise<CacheHitResult | null> => {
  const tCache = startTimer();
  let cacheHit: Awaited<ReturnType<typeof tryGetCachedResponse>> = null;
  try {
    const embeddingVec = await embedOne(query);
    cacheHit = await tryGetCachedResponse(query, async () => embeddingVec, scope);
  } catch (err) {
    console.warn('[Bokari] cache lookup failed; falling back to live:', err);
  }
  logStage('chat.cache_lookup', tCache(), { hit: cacheHit?.hitType ?? 'miss' });
  recordTiming('chat.cache_lookup', tCache());

  if (!cacheHit) return null;

  const tCacheRespond = startTimer();
  if (cacheHit.sources.length > 0) {
    await safeWrite(
      JSON.stringify({
        type: 'block',
        block: { id: crypto.randomUUID(), type: 'source', data: cacheHit.sources },
      }),
    );
  }
  const block = {
    id: crypto.randomUUID(),
    type: 'text',
    data: cacheHit.response,
  };
  await safeWrite(JSON.stringify({ type: 'block', block }));
  await safeWrite(JSON.stringify({ type: 'researchComplete' }));
  await safeWrite(JSON.stringify({ type: 'messageEnd' }));
  logStage('chat.cache_serve', tCacheRespond(), { hit: cacheHit.hitType, mode: scope.mode });
  recordTiming('chat.cache_serve', tCacheRespond());
  logStage('chat.total', tTotal(), { ok: true, cache: cacheHit.hitType });
  return { text: cacheHit.response, sources: cacheHit.sources };
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
  /** The cache hit's 'source' block data (citations), NOT the enabled
   *  source-type toggles (web/academic/…) — different concept, same word. */
  sourceBlocks: unknown[];
  fileIds: string[];
  userId?: string | null;
  responseText: string;
}): Promise<void> => {
  try {
    // Never write into a chat the caller does not own (BUG-15 class) — a
    // cache hit for someone else's chatId is silently skipped, not persisted.
    await assertChatAccess(input.chatId, input.userId ?? null, input.query);

    const responseBlocks = [
      ...(input.sourceBlocks.length > 0
        ? [{ id: crypto.randomUUID(), type: 'source', data: input.sourceBlocks }]
        : []),
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
