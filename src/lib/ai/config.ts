/**
 * @module ai/config
 * @description Env-var driven configuration for the Bokari AI gateway.
 *
 * Single source of truth for which model is the default for chat and
 * embeddings.  Users can override these in the Settings UI, but for the
 * "just works" path, we read env vars and ship sane OSS defaults.
 *
 * Why a config object and not direct env reads everywhere?
 *   - one place to mock in tests
 *   - one place to swap defaults (e.g. when we move from BGE-M3 to a
 *     better model in 6 months)
 *   - clear contract: callers depend on the typed shape, not on
 *     process.env sprawl.
 *
 * @author Amadou — Dicken AI
 * @version 1.0.0
 */

export type ChatRoute = {
  /** Primary provider id (matches Bokari provider key, e.g. "groq"). */
  provider: string;
  /** Model key on the primary provider. */
  model: string;
  /** Fallback if primary fails. Same shape. */
  fallback: { provider: string; model: string };
};

export type EmbeddingRoute = {
  provider: string;
  model: string;
  /** Embedding vector size.  Used to validate DB shape matches model. */
  dimensions: number;
};

export type AiConfig = {
  chat: ChatRoute;
  embedding: EmbeddingRoute;
};

/** Curated OSS defaults.  Tuned for African + multilingual + cheap. */
const DEFAULTS: AiConfig = {
  chat: {
    // Groq is fast and free-tier generous.  Llama 3.3 70B is the workhorse.
    provider: 'groq',
    model: 'llama-3.3-70b-versatile',
    // OpenRouter gives us the same model on a different provider — if
    // Groq is down, we still answer.
    fallback: {
      provider: 'openrouter',
      model: 'meta-llama/llama-3.3-70b-instruct',
    },
  },
  embedding: {
    // BGE-M3 via OpenRouter.  MIT, 100+ languages, 1024 dims, ~$0.01/1M tokens.
    provider: 'openrouter',
    model: 'baai/bge-m3',
    dimensions: 1024,
  },
};

/**
 * Read the AI config from env, falling back to the curated defaults.
 * Env vars (all optional):
 *   BOKARI_CHAT_PROVIDER, BOKARI_CHAT_MODEL
 *   BOKARI_CHAT_FALLBACK_PROVIDER, BOKARI_CHAT_FALLBACK_MODEL
 *   BOKARI_EMBEDDING_PROVIDER, BOKARI_EMBEDDING_MODEL, BOKARI_EMBEDDING_DIMENSIONS
 */
export function getAiConfig(): AiConfig {
  const cfg: AiConfig = JSON.parse(JSON.stringify(DEFAULTS));
  if (process.env.BOKARI_CHAT_PROVIDER) cfg.chat.provider = process.env.BOKARI_CHAT_PROVIDER;
  if (process.env.BOKARI_CHAT_MODEL) cfg.chat.model = process.env.BOKARI_CHAT_MODEL;
  if (process.env.BOKARI_CHAT_FALLBACK_PROVIDER)
    cfg.chat.fallback.provider = process.env.BOKARI_CHAT_FALLBACK_PROVIDER;
  if (process.env.BOKARI_CHAT_FALLBACK_MODEL)
    cfg.chat.fallback.model = process.env.BOKARI_CHAT_FALLBACK_MODEL;
  if (process.env.BOKARI_EMBEDDING_PROVIDER)
    cfg.embedding.provider = process.env.BOKARI_EMBEDDING_PROVIDER;
  if (process.env.BOKARI_EMBEDDING_MODEL)
    cfg.embedding.model = process.env.BOKARI_EMBEDDING_MODEL;
  if (process.env.BOKARI_EMBEDDING_DIMENSIONS) {
    const n = Number(process.env.BOKARI_EMBEDDING_DIMENSIONS);
    if (Number.isFinite(n) && n > 0) cfg.embedding.dimensions = n;
  }
  return cfg;
}
