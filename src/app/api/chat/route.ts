import { z } from 'zod';
import ModelRegistry from '@/lib/models/registry';
import { ModelWithProvider } from '@/lib/models/types';
import SearchAgent from '@/lib/agents/search';
import SessionManager from '@/lib/session';
import { ChatTurnMessage } from '@/lib/types';
import { SearchSources } from '@/lib/agents/search/types';
import supabase from '@/lib/db';
import UploadManager from '@/lib/uploads/manager';
import { createServerClient } from '@/lib/supabase/server';
import { startTimer, logStage } from '@/lib/observability/latence';
import { recordTiming, getTimings } from '@/lib/observability/ttfb';
import { MAX_HISTORY_ENTRIES, truncateHistory } from '@/lib/utils/chatHistory';
import { tryGetCachedResponse, cacheResponse } from '@/lib/cache/semantic';
import { embedOne } from '@/lib/ai/gateway';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const messageSchema = z.object({
  messageId: z.string().min(1, 'Message ID is required'),
  chatId: z.string().min(1, 'Chat ID is required'),
  content: z.string().min(1, 'Message content is required'),
});

const chatModelSchema: z.ZodType<ModelWithProvider> = z.object({
  providerId: z.string({ message: 'Chat model provider id must be provided' }),
  key: z.string({ message: 'Chat model key must be provided' }),
});

const embeddingModelSchema: z.ZodType<ModelWithProvider> = z.object({
  providerId: z.string({
    message: 'Embedding model provider id must be provided',
  }),
  key: z.string({ message: 'Embedding model key must be provided' }),
});

const bodySchema = z.object({
  message: messageSchema,
  optimizationMode: z.enum(['speed', 'balanced', 'quality'], {
    message: 'Optimization mode must be one of: speed, balanced, quality',
  }),
  sources: z.array(z.string()).optional().default([]),
  history: z
    .array(z.tuple([z.string(), z.string()]))
    .optional()
    .default([]),
  files: z.array(z.string()).optional().default([]),
  chatModel: chatModelSchema,
  embeddingModel: embeddingModelSchema,
  systemInstructions: z.string().nullable().optional().default(''),
});

type Body = z.infer<typeof bodySchema>;

const safeValidateBody = (data: unknown) => {
  const result = bodySchema.safeParse(data);
  if (!result.success) {
    return {
      success: false,
      error: result.error.issues.map((e: any) => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    };
  }
  return { success: true, data: result.data };
};

const ensureChatExists = async (input: {
  id: string;
  sources: SearchSources[];
  query: string;
  fileIds: string[];
  userId?: string;
}) => {
  try {
    const { data: exists } = await supabase
      .from('chats')
      .select('id')
      .eq('id', input.id)
      .maybeSingle();

    if (!exists) {
      await supabase.from('chats').insert({
        id: input.id,
        user_id: input.userId || null,
        title: input.query,
        sources: input.sources || [],
        files: input.fileIds.map((id) => ({
          fileId: id,
          name: UploadManager.getFile(id)?.name || 'Uploaded File',
        })),
      });
    }
  } catch (err) {
    console.error('Failed to check/save chat:', err);
  }
};

/**
 * Build the chat SSE stream.  Returns a `ReadableStream` that
 * the caller wires up to a `Response` object.
 *
 * Pattern (the Sprint 3 C2 refactor):
 *   1. Construct the `TransformStream` *before* doing any blocking
 *      work — model loading, Supabase auth, embedding lookups.
 *   2. Return the stream immediately to the caller so the first
 *      byte hits the wire ASAP.
 *   3. Kick off all async work (auth, model load, cache lookup,
 *      agent kick-off) after the stream is in flight.  All work
 *      writes to the same writer, so the client sees a coherent
 *      sequence of SSE events.
 *
 * This is the pattern recommended for Next.js App Router SSE
 * (see next.js issue #9965) to avoid the request timing out
 * before the first byte.
 */
const buildChatStream = (
  req: Request,
  body: Body,
  tTotal: () => number,
): ReadableStream<Uint8Array> => {
  const { message } = body;

  const responseStream = new TransformStream<Uint8Array, Uint8Array>();
  const writer = responseStream.writable.getWriter();
  const encoder = new TextEncoder();

  // Tiny initial event so the browser sees a connection within
  // a few ms of the request being sent.  This drops TTFB on the
  // client from "model-load + agent-kickoff" to "next tick".
  queueMicrotask(() => {
    void writer.write(encoder.encode(JSON.stringify({ type: 'open' }) + '\n'));
  });

  let tFirstBlock: (() => number) | null = null;
  let closed = false;

  const safeWrite = async (line: string): Promise<void> => {
    if (closed) return;
    try {
      await writer.write(encoder.encode(line + '\n'));
    } catch (err) {
      // Stream already closed — log and mark so we stop trying.
      closed = true;
      console.warn('[Bokari] chat stream write failed:', err);
    }
  };

  const tStart = startTimer();

  // All async work happens here, AFTER the stream is returned.
  void (async () => {
    let session: SessionManager | null = null;
    try {
      const tAuth = startTimer();
      const authClient = createServerClient(req);
      const {
        data: { user },
      } = await authClient.auth.getUser();
      logStage('chat.auth', tAuth(), { hasUser: !!user });
      recordTiming('chat.auth', tAuth());

      // Model load (was previously awaited before stream creation).
      const tLoad = startTimer();
      const registry = new ModelRegistry();
      const [llm, embedding] = await Promise.all([
        registry.loadChatModel(body.chatModel.providerId, body.chatModel.key),
        registry.loadEmbeddingModel(
          body.embeddingModel.providerId,
          body.embeddingModel.key,
        ),
      ]);
      logStage('chat.load_models', tLoad(), {
        chat: body.chatModel.key,
        embed: body.embeddingModel.key,
      });
      recordTiming('chat.load_models', tLoad());

      const history: ChatTurnMessage[] = truncateHistory(
        body.history,
        MAX_HISTORY_ENTRIES,
      ).map((msg) =>
        msg[0] === 'human'
          ? { role: 'user', content: msg[1] }
          : { role: 'assistant', content: msg[1] },
      );

      // Semantic cache fast path.  On hit we emit a single
      // "message" block with the cached response and end the
      // stream — saving the entire search → read → write chain.
      const tCache = startTimer();
      let cacheHit: Awaited<ReturnType<typeof tryGetCachedResponse>> = null;
      try {
        const embeddingVec = await embedOne(message.content);
        cacheHit = await tryGetCachedResponse(message.content, async () => embeddingVec);
      } catch (cacheErr) {
        console.warn('[Bokari] cache lookup failed; falling back to live:', cacheErr);
      }
      logStage('chat.cache_lookup', tCache(), { hit: cacheHit?.hitType ?? 'miss' });
      recordTiming('chat.cache_lookup', tCache());

      if (cacheHit) {
        const tCacheRespond = startTimer();
        const block = {
          id: crypto.randomUUID(),
          type: 'text',
          data: cacheHit.response,
        };
        await safeWrite(JSON.stringify({ type: 'block', block }));
        await safeWrite(JSON.stringify({ type: 'researchComplete' }));
        await safeWrite(JSON.stringify({ type: 'messageEnd' }));
        logStage('chat.cache_serve', tCacheRespond(), { hit: cacheHit.hitType });
        recordTiming('chat.cache_serve', tCacheRespond());
        logStage('chat.total', tTotal(), { ok: true, cache: cacheHit.hitType });
        try { await writer.close(); } catch { /* noop */ }
        closed = true;
        return;
      }

      session = SessionManager.createSession();
      const agent = new SearchAgent();

      const disconnect = session.subscribe((event: string, data: any) => {
        void (async () => {
          if (closed) return;
          if (event === 'data') {
            if (data.type === 'block') {
              if (!tFirstBlock) {
                tFirstBlock = startTimer();
                logStage('chat.first_block', tFirstBlock());
                recordTiming('chat.first_block', tFirstBlock());
              }
              await safeWrite(JSON.stringify({ type: 'block', block: data.block }));
            } else if (data.type === 'updateBlock') {
              await safeWrite(
                JSON.stringify({
                  type: 'updateBlock',
                  blockId: data.blockId,
                  patch: data.patch,
                }),
              );
            } else if (data.type === 'researchComplete') {
              await safeWrite(JSON.stringify({ type: 'researchComplete' }));
            }
          } else if (event === 'analyzing') {
            await safeWrite(
              JSON.stringify({ type: 'analyzing', step: data.step, message: data.message }),
            );
          } else if (event === 'end') {
            // Try to cache the response for next time.  We do this
            // best-effort — failures here must not break the
            // stream because the user already has their answer.
            const sess = session;
            if (!sess) return;
            try {
              const tCacheWrite = startTimer();
              const blocks = sess.getAllBlocks();
              const text = blocks
                .filter((b) => b.type === 'text')
                .map((b) => (b as { type: 'text'; data: string }).data)
                .join('\n');
              if (text) {
                const vec = await embedOne(message.content);
                await cacheResponse(message.content, vec, text, {
                  metadata: { mode: body.optimizationMode },
                });
              }
              logStage('chat.cache_write', tCacheWrite());
              recordTiming('chat.cache_write', tCacheWrite());
            } catch (cacheErr) {
              console.warn('[Bokari] cache write failed:', cacheErr);
            }
            await safeWrite(JSON.stringify({ type: 'messageEnd' }));
            logStage('chat.total', tTotal(), { ok: true, live: true });
            try { await writer.close(); } catch { /* noop */ }
            closed = true;
            sess.removeAllListeners();
          } else if (event === 'error') {
            await safeWrite(
              JSON.stringify({ type: 'error', data: data.data }),
            );
            logStage('chat.total', tTotal(), { ok: false });
            try { await writer.close(); } catch { /* noop */ }
            closed = true;
            if (session) session.removeAllListeners();
          }
        })();
      });

      ensureChatExists({
        id: body.message.chatId,
        sources: body.sources as SearchSources[],
        fileIds: body.files,
        query: message.content,
        userId: user?.id,
      });

      const tAgent = startTimer();
      agent
        .searchAsync(session, {
          chatHistory: history,
          followUp: message.content,
          chatId: body.message.chatId,
          messageId: body.message.messageId,
          config: {
            llm,
            embedding,
            sources: body.sources as SearchSources[],
            mode: body.optimizationMode,
            fileIds: body.files,
            systemInstructions: body.systemInstructions || 'None',
          },
        })
        .then(() => logStage('chat.agent', tAgent()))
        .catch((err) => {
          console.error('[Bokari] Search agent error:', err);
          logStage('chat.agent', tAgent(), { error: true });
          session?.emit('error', {
            data: 'Une erreur est survenue lors de la recherche. Veuillez reessayer.',
          });
        });

      req.signal.addEventListener('abort', () => {
        closed = true;
        disconnect();
        try { void writer.close(); } catch { /* noop */ }
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
    } finally {
      // Suppress unused-var lint; tStart is here for the future
      // "background-only" timing analysis.
      void tStart;
      void getTimings;
    }
  })();

  return responseStream.readable;
};

export const POST = async (req: Request) => {
  const tTotal = startTimer();
  try {
    const tParse = startTimer();
    const reqBody = (await req.json()) as Body;
    const parseBody = safeValidateBody(reqBody);
    if (!parseBody.success) {
      return Response.json(
        { message: 'Invalid request body', error: parseBody.error },
        { status: 400 },
      );
    }
    logStage('chat.parse', tParse(), { mode: (reqBody as any).optimizationMode });

    const body = parseBody.data as Body;
    const { message } = body;

    if (message.content === '') {
      return Response.json(
        { message: 'Please provide a message to process' },
        { status: 400 },
      );
    }

    // NEW: return the stream immediately, do all async work after.
    const stream = buildChatStream(req, body, tTotal);
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        Connection: 'keep-alive',
        'Cache-Control': 'no-cache, no-transform',
      },
    });
  } catch (err) {
    console.error('An error occurred while processing chat request:', err);
    logStage('chat.total', tTotal(), { ok: false, threw: true });
    return Response.json(
      { message: 'An error occurred while processing chat request' },
      { status: 500 },
    );
  }
};
