/**
 * @module app/api/chat/runBackground
 * @description Run the live chat pipeline in the background.
 *
 * Mirrors the original POST handler's logic (auth → model load
 * → search agent kickoff → write to stream) but as a single
 * async function the chat route can call AFTER the SSE response
 * is returned.  This is the "TTFB-in-a-tick" pattern.
 *
 * The function does not throw into the stream; errors are
 * caught and emitted as `error` events.
 */
import SearchAgent from '@/lib/agents/search';
import SessionManager from '@/lib/session';
import { ChatTurnMessage } from '@/lib/types';
import { SearchSources } from '@/lib/agents/search/types';
import { getCaller, HttpError } from '@/lib/auth/require';
import { resolveModels } from '@/lib/ai/resolve';
import { startTimer, logStage } from '@/lib/observability/latence';
import { recordTiming } from '@/lib/observability/ttfb';
import { MAX_HISTORY_ENTRIES, truncateHistory } from '@/lib/utils/chatHistory';
import supabase from '@/lib/db';
import UploadManager from '@/lib/uploads/manager';
import type { ChatStreamBody } from './stream';
import {
  wireSessionToWriter,
  SessionBridge,
} from './sessionBridge';

type Writer = (line: string) => Promise<void>;

type RunArgs = {
  req: Request;
  body: ChatStreamBody;
  message: { messageId: string; chatId: string; content: string };
  safeWrite: Writer;
  writer: WritableStreamDefaultWriter<Uint8Array>;
  encoder: TextEncoder;
  tTotal: () => number;
  onClose: () => void;
  sessionBridge: typeof wireSessionToWriter;
  writeCacheAfterEnd: (session: SessionManager) => Promise<void>;
};

/**
 * Ensure `input.id` exists as a chat, creating it on first use, and assert the
 * caller may write to it. Runs with the service-role client, so authorisation
 * is entirely ours: a chat owned by someone else is reported as 404, never
 * written to (BUG-15 / BUG-28 — this used to be fire-and-forget and ownerless).
 */
const ensureChatExists = async (input: {
  id: string;
  sources: SearchSources[];
  query: string;
  fileIds: string[];
  userId: string | null;
}): Promise<void> => {
  const { data: exists, error: lookupError } = await supabase
    .from('chats')
    .select('id, user_id')
    .eq('id', input.id)
    .maybeSingle();

  if (lookupError) throw new HttpError(500, 'CHAT_LOOKUP_FAILED');

  if (!exists) {
    const { error: insertError } = await supabase.from('chats').insert({
      id: input.id,
      user_id: input.userId,
      title: input.query,
      sources: input.sources || [],
      files: input.fileIds.map((id) => ({
        fileId: id,
        name: UploadManager.getFile(id)?.name || 'Uploaded File',
      })),
    });
    // A concurrent insert of the same id is fine; anything else is not.
    if (insertError && insertError.code !== '23505') {
      throw new HttpError(500, 'CHAT_CREATE_FAILED');
    }
    return;
  }

  if (exists.user_id !== input.userId) {
    throw new HttpError(404, 'NOT_FOUND');
  }
};

/**
 * Run the live chat pipeline.  Returns once the agent kicks off
 * (or an error is emitted).  The session may continue emitting
 * events asynchronously after this returns — those are wired
 * through `sessionBridge` directly to the writer.
 */
export const runChatBackground = async (args: RunArgs): Promise<void> => {
  const { req, body, message, safeWrite, writer, encoder, tTotal, onClose, sessionBridge, writeCacheAfterEnd } = args;

  let session: SessionManager | null = null;
  try {
    const tAuth = startTimer();
    const caller = await getCaller(req);
    const userId = caller?.userId ?? null;
    logStage('chat.auth', tAuth(), { hasUser: !!caller });
    recordTiming('chat.auth', tAuth());

    // Fail fast, before any model/search work is paid for: a chatId that
    // belongs to someone else (or a lookup failure) stops the request here.
    await ensureChatExists({
      id: body.message.chatId,
      sources: body.sources as SearchSources[],
      fileIds: body.files,
      query: message.content,
      userId,
    });

    const tLoad = startTimer();
    // The model is a single server-side decision (BOKARI_CHAT_PROVIDER/MODEL,
    // src/lib/ai/config.ts), never the browser's choice — the client used to
    // pick `bokari-1` (an alias for gpt-4o) on every request via localStorage,
    // which is both the most expensive option and the one that took the whole
    // product down when that account hit its rate limit (BUG-01).
    const { llm, fastLlm, embedding } = await resolveModels();
    logStage('chat.load_models', tLoad());
    recordTiming('chat.load_models', tLoad());

    const history: ChatTurnMessage[] = truncateHistory(
      body.history,
      MAX_HISTORY_ENTRIES,
    ).map((msg) =>
      msg[0] === 'human'
        ? { role: 'user', content: msg[1] }
        : { role: 'assistant', content: msg[1] },
    );

    session = SessionManager.createSession();
    const agent = new SearchAgent();
    const bridge: SessionBridge = sessionBridge(
      session,
      safeWrite,
      () => undefined,
      async (cache: boolean) => {
        // Terminal: cache the response only on success ('end'), never on error,
        // log, then close the stream.
        if (!session) return;
        if (cache) await writeCacheAfterEnd(session);
        logStage('chat.total', tTotal(), { ok: cache, live: true });
        onClose();
        try { await writer.close(); } catch { /* noop */ }
      },
    );

    const tAgent = startTimer();
    agent
      .searchAsync(session, {
        chatHistory: history,
        followUp: message.content,
        chatId: body.message.chatId,
        messageId: body.message.messageId,
        userId,
        config: {
          llm,
          fastLlm,
          embedding,
          sources: body.sources as SearchSources[],
          mode: body.optimizationMode,
          fileIds: body.files,
          systemInstructions: body.systemInstructions || 'None',
        },
      })
      .then(() => logStage('chat.agent', tAgent()))
      .catch((err: unknown) => {
        const e = err as { status?: number; code?: string; message?: string };
        // The generic French sentence used to be the ONLY thing anyone ever
        // saw. Log enough to diagnose from `docker logs` alone.
        console.error('[Bokari] search agent failed', {
          chatId: body.message.chatId,
          mode: body.optimizationMode,
          upstreamStatus: e?.status,
          upstreamCode: e?.code,
          message: e?.message,
        });
        logStage('chat.agent', tAgent(), { error: true });
        session?.emit('error', {
          data:
            e?.status === 429
              ? 'Le service est saturé. Réessaie dans un instant.'
              : 'La recherche a échoué. Réessaie — si le problème persiste, signale-le.',
          code: e?.status === 429 ? 'RATE_LIMITED' : 'SEARCH_FAILED',
        });
      });

    req.signal.addEventListener('abort', () => {
      bridge.disconnect();
      onClose();
      try { void writer.close(); } catch { /* noop */ }
    });
  } catch (err) {
    // The outer IIFE in stream.ts catches and emits the error event.
    throw err;
  }
  // Suppress unused-var lint: encoder is currently unused but
  // kept in the type for future first-event write hooks.
  void encoder;
};
