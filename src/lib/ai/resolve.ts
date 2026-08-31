import type BaseLLM from '@/lib/models/base/llm';
import type BaseEmbedding from '@/lib/models/base/embedding';
import type ModelRegistryType from '@/lib/models/registry';
import { loadConfiguredChatModel, loadConfiguredEmbeddingModel } from './gateway';

export type ResolvedModels = {
  llm: BaseLLM<any>;
  /** Optional cheaper tier. Absent when BOKARI_FAST_CHAT_* is not configured. */
  fastLlm?: BaseLLM<any>;
  embedding: BaseEmbedding<any>;
};

let cached: { at: number; models: ResolvedModels } | null = null;
const CACHE_MS = 60_000;

/**
 * The single entry point for "which models do we run on".
 *
 * Cached for a minute: model instances are stateless wrappers, but building one
 * for Groq/Anthropic/Gemini triggers a network call to /models. Rebuilding that
 * on every request added a round-trip to the SSE hot path for no benefit.
 */
export async function resolveModels(): Promise<ResolvedModels> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.models;

  const [llm, embedding] = await Promise.all([
    loadConfiguredChatModel(),
    loadConfiguredEmbeddingModel(),
  ]);

  // Fast tier is addressed by provider id + model key (same registry lookup
  // as the base model selector used to be), not by provider type — it points
  // at a specific configured provider instance, e.g. a Groq 8B model, and
  // predates this module. Keeping the same env vars avoids a silent
  // config-format break for anyone who already set them.
  let fastLlm: BaseLLM<any> | undefined;
  const fastProviderId = process.env.BOKARI_FAST_CHAT_PROVIDER_ID;
  const fastKey = process.env.BOKARI_FAST_CHAT_KEY;
  if (fastProviderId && fastKey) {
    try {
      // Dynamic require, not a top-of-file import: the registry constructor
      // reads/writes the Bokari config file, a side effect this module must
      // not trigger just by being imported (same reasoning as ai/gateway.ts).
      const ModelRegistry = require('@/lib/models/registry')
        .default as typeof ModelRegistryType;
      const registry = new ModelRegistry();
      fastLlm = await registry.loadChatModel(fastProviderId, fastKey);
    } catch (err) {
      // A missing fast tier is a degradation, not a failure — but say so.
      console.warn('[Bokari AI] fast tier unavailable, falling back to default', {
        providerId: fastProviderId,
        error: (err as Error)?.message ?? err,
      });
    }
  }

  const models: ResolvedModels = { llm, fastLlm, embedding };
  cached = { at: Date.now(), models };
  return models;
}

/** Drop the cache — used by tests and by the admin "reload models" action. */
export function resetResolvedModels(): void {
  cached = null;
}
