import type BaseLLM from '@/lib/models/base/llm';
import type BaseEmbedding from '@/lib/models/base/embedding';
import type ModelRegistryType from '@/lib/models/registry';
import {
  loadConfiguredChatModel,
  loadConfiguredEmbeddingModel,
} from './gateway';

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

  // Fast tier: preferred addressing is provider TYPE + model key
  // (BOKARI_FAST_CHAT_PROVIDER / BOKARI_FAST_CHAT_MODEL), resolved through
  // the same gateway path as the base model — portable across environments,
  // unlike a provider UUID baked into one config.json. The legacy UUID form
  // (BOKARI_FAST_CHAT_PROVIDER_ID + BOKARI_FAST_CHAT_KEY) still works as a
  // fallback when the type form is absent, so existing deployments keep
  // working untouched.
  let fastLlm: BaseLLM<any> | undefined;
  const fastProvider = process.env.BOKARI_FAST_CHAT_PROVIDER;
  const fastModel = process.env.BOKARI_FAST_CHAT_MODEL;
  if (fastProvider && fastModel) {
    try {
      const { loadChatByType } =
        require('@/lib/ai/gateway') as typeof import('@/lib/ai/gateway');
      fastLlm = (await loadChatByType(fastProvider, fastModel)) as BaseLLM<any>;
    } catch (err) {
      // A missing fast tier is a degradation, not a failure — but say so.
      console.warn(
        '[Bokari AI] fast tier unavailable, falling back to default',
        {
          provider: fastProvider,
          model: fastModel,
          error: (err as Error)?.message ?? err,
        },
      );
    }
  } else {
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
        console.warn(
          '[Bokari AI] fast tier unavailable, falling back to default',
          {
            providerId: fastProviderId,
            error: (err as Error)?.message ?? err,
          },
        );
      }
    }
  }

  const models: ResolvedModels = { llm, fastLlm, embedding };
  cached = { at: Date.now(), models };
  return models;
}

/**
 * Fast-tier status for the admin overview: which model serves the cheap
 * roles, or why none does. Lets an operator verify the cost routing from
 * /admin instead of grepping prod logs.
 */
export function fastTierStatus():
  | { configured: true; provider: string; model: string }
  | { configured: false; reason: string } {
  const provider = process.env.BOKARI_FAST_CHAT_PROVIDER;
  const model = process.env.BOKARI_FAST_CHAT_MODEL;
  if (provider && model) return { configured: true, provider, model };
  if (
    process.env.BOKARI_FAST_CHAT_PROVIDER_ID &&
    process.env.BOKARI_FAST_CHAT_KEY
  ) {
    return {
      configured: true,
      provider: `id:${process.env.BOKARI_FAST_CHAT_PROVIDER_ID}`,
      model: process.env.BOKARI_FAST_CHAT_KEY,
    };
  }
  return {
    configured: false,
    reason: 'BOKARI_FAST_CHAT_PROVIDER/MODEL not set',
  };
}

/** Drop the cache — used by tests and by the admin "reload models" action. */
export function resetResolvedModels(): void {
  cached = null;
}
