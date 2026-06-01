/**
 * @module ai/gateway
 * @description Single entry point for all AI calls in Bokari.
 *
 * This is the "infra" the team is building.  Every other module in the
 * codebase that needs an embedding or a chat completion goes through
 * here.  That gives us:
 *
 *   1. One place to swap models (BGE-M3 today, Qwen3-Embedding tomorrow).
 *   2. One place to implement fallback (Groq → OpenRouter for chat).
 *   3. One place to instrument (latency, token usage, errors).
 *   4. One place to mock in tests.
 *
 * Design rules:
 *   - The gateway never throws on transient errors — it retries and
 *     falls back.  Callers get either a successful result or a hard
 *     `Error` after all paths are exhausted.
 *   - Embeddings are always batched (32 at a time) to keep latency low
 *     and to be polite to the upstream API.
 *   - Chat fallback only fires if the primary provider throws — we
 *     don't fall back on a "weird" response.
 *
 * @author Amadou — Dicken AI
 * @version 1.0.0
 */
import type BaseEmbedding from '@/lib/models/base/embedding';
import type BaseLLM from '@/lib/models/base/llm';
import type ModelRegistryType from '@/lib/models/registry';
import { getAiConfig } from './config';

const MAX_RETRIES = 2;
const RETRY_BACKOFF_MS = 400;
const EMBED_BATCH_SIZE = 32;

// Lazy registry singleton.  We don't import ModelRegistry at the top
// of the file because the registry constructor reads / writes the
// Bokari config file, which would break any test that imports the
// gateway without first setting up a tmp data dir.  By deferring the
// `new` until the first call, helpers like `articleToEmbedText` and
// `getAiConfig` stay pure-import-safe.
let _registry: ModelRegistryType | null = null;
function getRegistry(): ModelRegistryType {
  if (_registry) return _registry;
  // Dynamic require to avoid the top-of-file side effect.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const ModelRegistry = require('@/lib/models/registry').default;
  const r = new ModelRegistry();
  _registry = r;
  return r;
}

/**
 * Translate a Bokari provider *type* (e.g. "openrouter") to the
 * runtime provider *id* (e.g. the UUID Bokari assigned in the config
 * file).  Returns null when no active provider of that type exists.
 */
async function resolveProviderId(type: string): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { getConfiguredModelProviders } = require('@/lib/config/serverRegistry');
  const configured: any[] = getConfiguredModelProviders();
  const match = configured.find((p) => p.type === type);
  return match?.id ?? null;
}

async function loadChatByType(type: string, model: string): Promise<BaseLLM<any>> {
  const id = await resolveProviderId(type);
  if (!id) throw new Error(`[ai/gateway] no active provider of type "${type}". Add it in Settings → Models.`);
  return getRegistry().loadChatModel(id, model);
}

async function loadEmbeddingByType(
  type: string,
  model: string,
): Promise<BaseEmbedding<any>> {
  const id = await resolveProviderId(type);
  if (!id) throw new Error(`[ai/gateway] no active provider of type "${type}". Add it in Settings → Models.`);
  return getRegistry().loadEmbeddingModel(id, model);
}

/**
 * Run a function with exponential backoff.  Used for transient errors
 * (5xx, rate limits, network).  Stops on the first non-retryable error
 * (e.g. 4xx other than 429).
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  retries: number = MAX_RETRIES,
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      const status = err?.status ?? err?.response?.status;
      const retryable =
        status === 429 || (typeof status === 'number' && status >= 500) || !status;
      if (!retryable || i === retries) break;
      const wait = RETRY_BACKOFF_MS * Math.pow(2, i);
      console.warn(`[ai/gateway] ${label} retry ${i + 1}/${retries} after ${wait}ms: ${err?.message ?? err}`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastErr;
}

/**
 * Embed a batch of strings using the configured embedding route.
 * Returns a `number[][]` of vectors aligned with the input order.
 *
 * Batches the input into chunks of 32 to be polite to the upstream
 * provider.  The full result is concatenated before being returned.
 *
 * Throws only after all retries are exhausted.
 */
export async function embed(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const cfg = getAiConfig().embedding;

  const model = (await withRetry(
    () => loadEmbeddingByType(cfg.provider, cfg.model),
    `embed-load[${cfg.provider}/${cfg.model}]`,
  )) as BaseEmbedding<any>;

  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += EMBED_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBED_BATCH_SIZE);
    const vectors: number[][] = await withRetry(
      () => model.embedText(batch),
      `embed-call[${cfg.model}] batch=${i / EMBED_BATCH_SIZE}`,
    );
    for (const v of vectors) out.push(v);
  }
  return out;
}

/** Convenience: embed a single string and return the first vector. */
export async function embedOne(text: string): Promise<number[]> {
  const [v] = await embed([text]);
  if (!v) throw new Error('[ai/gateway] embedOne returned no vector');
  return v;
}

/**
 * Build the standard "title-weighted" embedding input for an article.
 * Title is repeated because it carries the most semantic weight for
 * news search; BGE-M3 averages tokens, so repetition is a cheap
 * weighting trick that keeps cost identical to a single-pass embed.
 *
 * `maxBodyChars` caps the body to keep token usage low — 1500 chars
 * is roughly 350-400 tokens, well under BGE-M3's 8192 context.
 */
export function articleToEmbedText(
  title: string,
  body: string | null | undefined,
  maxBodyChars: number = 1500,
): string {
  const t = (title || '').trim();
  const b = (body || '').trim().slice(0, maxBodyChars);
  if (!t && !b) return '';
  if (!b) return `${t}\n${t}`;
  return `${t}\n${t}\n${b}`;
}

/**
 * Run a chat completion with primary → fallback.  The `call` argument
 * is `(model) => Promise<T>` so the caller can use any model API
 * (`.invoke`, `.stream`, structured outputs, etc.) without us
 * re-implementing it.
 *
 * If the primary throws (after retries), we silently fall back to the
 * secondary.  If the secondary also throws, we re-throw the secondary
 * error so the caller sees the most recent failure.
 */
export async function chatWithFallback<T>(
  call: (model: BaseLLM<any>) => Promise<T>,
  label: string = 'chat',
): Promise<T> {
  const cfg = getAiConfig().chat;

  // Load primary directly (no retry) — if the provider isn't even
  // configured, retrying won't help.  We fall back below.
  let primary: BaseLLM<any>;
  try {
    primary = (await loadChatByType(cfg.provider, cfg.model)) as BaseLLM<any>;
  } catch (loadErr) {
    console.warn(
      `[ai/gateway] ${label} primary ${cfg.provider}/${cfg.model} not loadable: ${
        (loadErr as any)?.message ?? loadErr
      } — falling back to ${cfg.fallback.provider}/${cfg.fallback.model}`,
    );
    const fallback = (await loadChatByType(
      cfg.fallback.provider,
      cfg.fallback.model,
    )) as BaseLLM<any>;
    return await call(fallback);
  }

  try {
    return await call(primary);
  } catch (primaryErr) {
    console.warn(
      `[ai/gateway] ${label} primary ${cfg.provider}/${cfg.model} failed: ${
        (primaryErr as any)?.message ?? primaryErr
      } — falling back to ${cfg.fallback.provider}/${cfg.fallback.model}`,
    );

    const fallback = (await loadChatByType(
      cfg.fallback.provider,
      cfg.fallback.model,
    )) as BaseLLM<any>;

    return await call(fallback);
  }
}
