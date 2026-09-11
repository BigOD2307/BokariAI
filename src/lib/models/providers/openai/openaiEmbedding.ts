import OpenAI from 'openai';
import BaseEmbedding from '../../base/embedding';
import { Chunk } from '@/lib/types';
import { recordUsage } from '@/lib/ai/usage';

type OpenAIConfig = {
  apiKey: string;
  model: string;
  baseURL?: string;
};

class OpenAIEmbedding extends BaseEmbedding<OpenAIConfig> {
  openAIClient: OpenAI;

  constructor(protected config: OpenAIConfig) {
    super(config);

    this.openAIClient = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    });
  }

  async embedText(texts: string[]): Promise<number[][]> {
    const response = await this.openAIClient.embeddings.create({
      model: this.config.model,
      input: texts,
    });

    recordUsage({
      label: 'embedding',
      model: this.config.model,
      usage: response.usage
        ? {
            promptTokens: response.usage.prompt_tokens ?? 0,
            completionTokens: 0,
          }
        : undefined,
    });

    return response.data.map((embedding) => embedding.embedding);
  }

  async embedChunks(chunks: Chunk[]): Promise<number[][]> {
    const response = await this.openAIClient.embeddings.create({
      model: this.config.model,
      input: chunks.map((c) => c.content),
    });

    recordUsage({
      label: 'embedding',
      model: this.config.model,
      usage: response.usage
        ? {
            promptTokens: response.usage.prompt_tokens ?? 0,
            completionTokens: 0,
          }
        : undefined,
    });

    return response.data.map((embedding) => embedding.embedding);
  }
}

export default OpenAIEmbedding;
