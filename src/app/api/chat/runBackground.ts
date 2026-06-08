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
import ModelRegistry from '@/lib/models/registry';
import SearchAgent from '@/lib/agents/search';
import SessionManager from '@/lib/session';
import { ChatTurnMessage } from '@/lib/types';
import { SearchSources } from '@/lib/agents/search/types';
import { createServerClient } from '@/lib/supabase/server';
import {
  loadConfiguredChatModel,
  loadConfiguredEmbeddingModel,
} from '@/lib/ai/gateway';
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
    const authClient = createServerClient(req);
    const {
      data: { user },
    } = await authClient.auth.getUser();
    logStage('chat.auth', tAuth(), { hasUser: !!user });
    recordTiming('chat.auth', tAuth());

    const tLoad = startTimer();
    const registry = new ModelRegistry();
    // The base model is one env-driven decision (getAiConfig → Nemotron), not
    // per-browser localStorage. When BOKARI_CHAT_MODEL is set we resolve the
    // model server-side via the gateway; otherwise we honour the client's
    // selection. Either path degrades gracefully if its model can't load.
    const useConfigured = !!process.env.BOKARI_CHAT_MODEL;
    const [llm, embedding] = await Promise.all([
      useConfigured
        ? loadConfiguredChatModel().catch((err) => {
            console.warn(
              '[Bokari] configured chat model failed; using client-selected:',
              err,
            );
            return registry.loadChatModel(
              body.chatModel.providerId,
              body.chatModel.key,
            );
          })
        : registry.loadChatModel(body.chatModel.providerId, body.chatModel.key),
      useConfigured
        ? loadConfiguredEmbeddingModel().catch((err) => {
            console.warn(
              '[Bokari] configured embedding model failed; using client-selected:',
              err,
            );
            return registry.loadEmbeddingModel(
              body.embeddingModel.providerId,
              body.embeddingModel.key,
            );
          })
        : registry.loadEmbeddingModel(
            body.embeddingModel.providerId,
            body.embeddingModel.key,
          ),
    ]);
    logStage('chat.load_models', tLoad(), {
      chat: useConfigured ? 'configured' : body.chatModel.key,
      embed: useConfigured ? 'configured' : body.embeddingModel.key,
    });
    recordTiming('chat.load_models', tLoad());

    // Optional fast tier (e.g. Groq Llama 3.1 8B) for simple queries —
    // env-gated, with a safe fallback to the default model when unset or
    // unavailable. Set BOKARI_FAST_CHAT_PROVIDER_ID + BOKARI_FAST_CHAT_KEY to
    // enable model-tier routing (see SearchAgent / pickWriterLlm).
    let fastLlm: typeof llm | undefined;
    const fastProviderId = process.env.BOKARI_FAST_CHAT_PROVIDER_ID;
    const fastKey = process.env.BOKARI_FAST_CHAT_KEY;
    if (fastProviderId && fastKey) {
      try {
        fastLlm = await registry.loadChatModel(fastProviderId, fastKey);
      } catch (err) {
        console.warn(
          '[Bokari] fast chat model unavailable; routing disabled:',
          err,
        );
      }
    }

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
          fastLlm,
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
