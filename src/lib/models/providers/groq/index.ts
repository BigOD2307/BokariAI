import { UIConfigField } from '@/lib/config/types';
import { getConfiguredModelProviderById } from '@/lib/config/serverRegistry';
import { Model, ModelList, ProviderMetadata } from '../../types';
import BaseEmbedding from '../../base/embedding';
import BaseModelProvider from '../../base/provider';
import BaseLLM from '../../base/llm';
import GroqLLM from './groqLLM';

interface GroqConfig {
  apiKey: string;
}

const providerConfigFields: UIConfigField[] = [
  {
    type: 'password',
    name: 'API Key',
    key: 'apiKey',
    description: 'Your Groq API key',
    required: true,
    placeholder: 'Groq API Key',
    env: 'GROQ_API_KEY',
    scope: 'server',
  },
];

/** How long a fetched model list stays valid before /models is hit again.
 *  Was refetched on EVERY model load — one extra network round trip per
 *  chat/classifier/writer call for no benefit, since the catalogue barely
 *  changes. */
const MODEL_LIST_TTL_MS = 10 * 60_000;

class GroqProvider extends BaseModelProvider<GroqConfig> {
  private defaultModelsCache: { at: number; list: ModelList } | null = null;

  constructor(id: string, name: string, config: GroqConfig) {
    super(id, name, config);
  }

  async getDefaultModels(): Promise<ModelList> {
    const cached = this.defaultModelsCache;
    if (cached && Date.now() - cached.at < MODEL_LIST_TTL_MS) {
      return cached.list;
    }
    const list = await this.fetchDefaultModels();
    this.defaultModelsCache = { at: Date.now(), list };
    return list;
  }

  private async fetchDefaultModels(): Promise<ModelList> {
    const res = await fetch(`https://api.groq.com/openai/v1/models`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
    });

    const data = await res.json();

    const defaultChatModels: Model[] = [];

    data.data.forEach((m: any) => {
      defaultChatModels.push({
        key: m.id,
        name: m.id,
      });
    });

    return {
      embedding: [],
      chat: defaultChatModels,
    };
  }

  async getModelList(): Promise<ModelList> {
    const defaultModels = await this.getDefaultModels();
    const configProvider = getConfiguredModelProviderById(this.id)!;

    return {
      embedding: [
        ...defaultModels.embedding,
        ...configProvider.embeddingModels,
      ],
      chat: [...defaultModels.chat, ...configProvider.chatModels],
    };
  }

  async loadChatModel(key: string): Promise<BaseLLM<any>> {
    const modelList = await this.getModelList();

    const exists = modelList.chat.find((m) => m.key === key);

    if (!exists) {
      throw new Error('Error Loading Groq Chat Model. Invalid Model Selected');
    }

    return new GroqLLM({
      apiKey: this.config.apiKey,
      model: key,
      baseURL: 'https://api.groq.com/openai/v1',
    });
  }

  async loadEmbeddingModel(key: string): Promise<BaseEmbedding<any>> {
    throw new Error('Groq Provider does not support embedding models.');
  }

  static parseAndValidate(raw: any): GroqConfig {
    if (!raw || typeof raw !== 'object')
      throw new Error('Invalid config provided. Expected object');
    if (!raw.apiKey)
      throw new Error('Invalid config provided. API key must be provided');

    return {
      apiKey: String(raw.apiKey),
    };
  }

  static getProviderConfigFields(): UIConfigField[] {
    return providerConfigFields;
  }

  static getProviderMetadata(): ProviderMetadata {
    return {
      key: 'groq',
      name: 'Groq',
    };
  }
}

export default GroqProvider;
