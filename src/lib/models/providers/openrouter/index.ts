/**
 * @module models/providers/openrouter
 * @description OpenRouter provider registration.
 *
 * OpenRouter is a unified API gateway for OSS + proprietary models.
 * It exposes both /chat/completions and /embeddings, OpenAI-compatible.
 *
 * Default embedding model: baai/bge-m3 (MIT, 1024 dims, best multilingual
 * for African languages, available for ~$0.01/1M tokens on OpenRouter).
 *
 * Default chat model: meta-llama/llama-3.3-70b-instruct (OSS, strong
 * reasoning, available on many providers via OpenRouter for redundancy).
 *
 * @author Amadou — Dicken AI
 * @version 1.0.0
 */
import { UIConfigField } from '@/lib/config/types';
import { getConfiguredModelProviderById } from '@/lib/config/serverRegistry';
import { Model, ModelList, ProviderMetadata } from '../../types';
import BaseEmbedding from '../../base/embedding';
import BaseModelProvider from '../../base/provider';
import BaseLLM from '../../base/llm';
import OpenRouterLLM from './openrouterLLM';
import OpenRouterEmbedding from './openrouterEmbedding';

interface OpenRouterConfig {
  apiKey: string;
}

const providerConfigFields: UIConfigField[] = [
  {
    type: 'password',
    name: 'API Key',
    key: 'apiKey',
    description: 'Your OpenRouter API key (https://openrouter.ai/keys)',
    required: true,
    placeholder: 'sk-or-v1-…',
    env: 'OPENROUTER_API_KEY',
    scope: 'server',
  },
];

/**
 * Curated default models for OpenRouter.  We pick OSS, multilingual,
 * and battle-tested choices.  Users can add more via the Settings UI.
 */
const DEFAULT_CHAT_MODELS: Model[] = [
  { key: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B Instruct (OSS)' },
  { key: 'meta-llama/llama-3.1-8b-instruct', name: 'Llama 3.1 8B Instruct (OSS, fast)' },
  { key: 'qwen/qwen3-32b', name: 'Qwen3 32B (OSS)' },
  { key: 'google/gemma-3-27b-it', name: 'Gemma 3 27B IT (OSS)' },
  { key: 'mistralai/mistral-nemo', name: 'Mistral Nemo (OSS)' },
];

const DEFAULT_EMBEDDING_MODELS: Model[] = [
  { key: 'baai/bge-m3', name: 'BGE-M3 (MIT, multilingual, 100+ langs)' },
  { key: 'qwen/qwen3-embedding-8b', name: 'Qwen3-Embedding-8B (Apache 2.0, SOTA multilingual)' },
  { key: 'intfloat/multilingual-e5-large', name: 'multilingual-e5-large (MIT)' },
  { key: 'openai/text-embedding-3-small', name: 'OpenAI text-embedding-3-small (paid)' },
];

class OpenRouterProvider extends BaseModelProvider<OpenRouterConfig> {
  constructor(id: string, name: string, config: OpenRouterConfig) {
    super(id, name, config);
  }

  async getDefaultModels(): Promise<ModelList> {
    return {
      chat: DEFAULT_CHAT_MODELS,
      embedding: DEFAULT_EMBEDDING_MODELS,
    };
  }

  async getModelList(): Promise<ModelList> {
    const defaults = await this.getDefaultModels();
    const configProvider = getConfiguredModelProviderById(this.id);

    if (!configProvider) {
      return defaults;
    }

    return {
      embedding: [
        ...defaults.embedding,
        ...(configProvider.embeddingModels ?? []),
      ],
      chat: [
        ...defaults.chat,
        ...(configProvider.chatModels ?? []),
      ],
    };
  }

  async loadChatModel(key: string): Promise<BaseLLM<any>> {
    const modelList = await this.getModelList();
    const exists = modelList.chat.find((m) => m.key === key);
    if (!exists) {
      throw new Error('Error Loading OpenRouter Chat Model. Invalid Model Selected');
    }
    return new OpenRouterLLM({
      apiKey: this.config.apiKey,
      model: key,
    });
  }

  async loadEmbeddingModel(key: string): Promise<BaseEmbedding<any>> {
    const modelList = await this.getModelList();
    const exists = modelList.embedding.find((m) => m.key === key);
    if (!exists) {
      throw new Error('Error Loading OpenRouter Embedding Model. Invalid Model Selected');
    }
    return new OpenRouterEmbedding({
      apiKey: this.config.apiKey,
      model: key,
    });
  }

  static parseAndValidate(raw: any): OpenRouterConfig {
    if (!raw || typeof raw !== 'object') {
      throw new Error('Invalid config provided. Expected object');
    }
    if (!raw.apiKey) {
      throw new Error('Invalid config provided. API key must be provided');
    }
    return { apiKey: String(raw.apiKey) };
  }

  static getProviderConfigFields(): UIConfigField[] {
    return providerConfigFields;
  }

  static getProviderMetadata(): ProviderMetadata {
    return {
      key: 'openrouter',
      name: 'OpenRouter',
    };
  }
}

export default OpenRouterProvider;
