/**
 * @module app/api/chat/stream
 * @description Build the SSE stream for the chat endpoint.
 *
 * This is the meat of the Sprint 3 C2 refactor: all async work
 * (auth, model load, cache lookup, agent kickoff) happens AFTER
 * the stream is returned, so client-visible TTFB drops to a
 * single tick.
 *
 * Returns a `ReadableStream<Uint8Array>` — the caller wires it
 * up to a `Response` with the SSE headers.  We never throw into
 * the stream; errors are emitted as `{"type":"error",...}` events
 * and the stream is closed.
 */
import { startTimer, logStage } from '@/lib/observability/latence';
import { recordTiming } from '@/lib/observability/ttfb';
import { cacheResponse, hashHistory, type CacheScope } from '@/lib/cache/semantic';
import { embedOne } from '@/lib/ai/gateway';
import { runChatBackground } from './runBackground';
import { tryServeCacheHit, persistCacheHit } from './cacheHit';
import { wireSessionToWriter } from './sessionBridge';
import { getCaller } from '@/lib/auth/require';

/** Body shape required by `buildChatStream`.  Matches the POST
 *  route's validated body. */
export type ChatStreamBody = {
  message: { messageId: string; chatId: string; content: string };
  optimizationMode: 'speed' | 'balanced' | 'quality' | 'learn';
  sources: string[];
  history: [string, string][];
  files: string[];
  systemInstructions: string | null | undefined;
};

/**
 * Build the chat SSE stream.  Returns a `ReadableStream` that
 * the caller wires up to a `Response` object.  See the module
 * docstring for the pattern.
 */
export const buildChatStream = (
  req: Request,
  body: ChatStreamBody,
  tTotal: () => number,
): ReadableStream<Uint8Array> => {
  const { message } = body;
  const responseStream = new TransformStream<Uint8Array, Uint8Array>();
  const writer = responseStream.writable.getWriter();
  const encoder = new TextEncoder();

  // First-event-in-a-tick so the browser sees a connection within
  // a few ms of the request being sent.
  queueMicrotask(() => {
    void writer.write(encoder.encode(JSON.stringify({ type: 'open' }) + '\n'));
  });

  let closed = false;
  const safeWrite = async (line: string): Promise<void> => {
    if (closed) return;
    try {
      await writer.write(encoder.encode(line + '\n'));
    } catch {
      closed = true;
    }
  };

  // Cache scope: mode + recent history + files + enabled sources. A request
  // grounded in uploaded files never reads or writes the cache at all
  // (isCacheable) — see src/lib/cache/semantic.ts for why (BUG-25).
  const cacheScope: CacheScope = {
    mode: body.optimizationMode,
    historyHash: hashHistory(body.history),
    fileIds: body.files,
    sources: body.sources,
  };

  // All async work happens here, AFTER the stream is returned.
  void (async () => {
    try {
      const cacheHit = await tryServeCacheHit(message.content, cacheScope, safeWrite, tTotal);
      if (cacheHit !== null) {
        // Persist the cache-hit conversation so it shows up — and opens fully —
        // in the user's history (the live agent path does this; the cache
        // fast-path used to skip it, so repeat queries vanished from history).
        try {
          const caller = await getCaller(req);
          await persistCacheHit({
            chatId: message.chatId,
            messageId: message.messageId,
            query: message.content,
            sourceBlocks: cacheHit.sources,
            fileIds: body.files,
            userId: caller?.userId ?? null,
            responseText: cacheHit.text,
          });
        } catch (e) {
          console.warn('[Bokari] cache-hit persist error:', e);
        }
        try { await writer.close(); } catch { /* noop */ }
        closed = true;
        return;
      }
      await runChatBackground({
        req,
        body,
        message,
        safeWrite,
        writer,
        encoder,
        tTotal,
        onClose: () => {
          closed = true;
        },
        sessionBridge: wireSessionToWriter,
        writeCacheAfterEnd: async (session) => {
          const sess = session;
          try {
            const tCacheWrite = startTimer();
            const blocks = sess.getAllBlocks();
            const text = blocks
              .filter((b) => b.type === 'text')
              .map((b) => (b as { type: 'text'; data: string }).data)
              .join('\n');
            // Cache the sources alongside the text so a future hit can
            // replay the answer WITH its citations resolvable, not a bare
            // text blob with dangling [n]s (BUG-25).
            const sourceBlock = blocks.find((b) => b.type === 'source') as
              | { type: 'source'; data: unknown[] }
              | undefined;
            if (text) {
              const vec = await embedOne(message.content);
              await cacheResponse(message.content, vec, text, cacheScope, {
                sources: sourceBlock?.data ?? [],
                metadata: { mode: body.optimizationMode },
              });
            }
            logStage('chat.cache_write', tCacheWrite());
            recordTiming('chat.cache_write', tCacheWrite());
          } catch (err) {
            console.warn('[Bokari] cache write failed:', err);
          }
        },
      });
    } catch (err) {
      console.error('[Bokari] chat stream background error:', err);
      logStage('chat.total', tTotal(), { ok: false, threw: true });
      await safeWrite(
        JSON.stringify({
          type: 'error',
          data: 'Une erreur est survenue. Veuillez reessayer.',
        }),
      );
      try { await writer.close(); } catch { /* noop */ }
      closed = true;
    }
  })();

  return responseStream.readable;
};
