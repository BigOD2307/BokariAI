/**
 * @module models/providers/openrouter/openrouterEmbedding
 * @description OpenRouter embeddings provider.  Same shape as OpenAI
 * embeddings — we reuse the openai SDK with a different baseURL.
 * @author Amadou — Dicken AI
 * @version 1.0.0
 */
import OpenAI from 'openai';
import BaseEmbedding from '../../base/embedding';
import { Chunk } from '@/lib/types';

type OpenRouterConfig = {
  apiKey: string;
  model: string;
  baseURL?: string;
};

class OpenRouterEmbedding extends BaseEmbedding<OpenRouterConfig> {
  client: OpenAI;

  constructor(protected config: OpenRouterConfig) {
    super(config);
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL ?? 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': 'https://bokari.ai',
        'X-Title': 'Bokari',
      },
    });
  }

  async embedText(texts: string[]): Promise<number[][]> {
    const response = await this.client.embeddings.create({
      model: this.config.model,
      input: texts,
    });
    return response.data.map((e) => e.embedding);
  }

  async embedChunks(chunks: Chunk[]): Promise<number[][]> {
    return this.embedText(chunks.map((c) => c.content));
  }
}

export default OpenRouterEmbedding;
