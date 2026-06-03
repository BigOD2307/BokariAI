/**
 * @module app/api/chat/cacheHit
 * @description Cache fast-path for the chat SSE stream.
 *
 * On a semantic-cache hit we don't need to do any agent work —
 * we just emit a single text block + researchComplete + messageEnd
 * and close the stream.  This drops the response from "seconds"
 * to "single tick" for any repeat query.
 */
import { startTimer, logStage } from '@/lib/observability/latence';
import { recordTiming } from '@/lib/observability/ttfb';
import { tryGetCachedResponse } from '@/lib/cache/semantic';
import { embedOne } from '@/lib/ai/gateway';

type Writer = (line: string) => Promise<void>;

/**
 * Look up the query in the cache.  On hit, write the cached
 * response to the stream and return true.  On miss, return false.
 */
export const tryServeCacheHit = async (
  query: string,
  mode: 'speed' | 'balanced' | 'quality',
  safeWrite: Writer,
  tTotal: () => number,
): Promise<boolean> => {
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

  if (!cacheHit) return false;

  const tCacheRespond = startTimer();
  const block = {
    id: crypto.randomUUID(),
    type: 'text',
    data: cacheHit.response,
  };
  await safeWrite(JSON.stringify({ type: 'block', block }));
  await safeWrite(JSON.stringify({ type: 'researchComplete' }));
  await safeWrite(JSON.stringify({ type: 'messageEnd' }));
  logStage('chat.cache_serve', tCacheRespond(), {
    hit: cacheHit.hitType,
    mode,
  });
  recordTiming('chat.cache_serve', tCacheRespond());
  logStage('chat.total', tTotal(), { ok: true, cache: cacheHit.hitType });
  return true;
};
