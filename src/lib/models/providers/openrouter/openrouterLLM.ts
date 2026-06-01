/**
 * @module models/providers/openrouter/openrouterLLM
 * @description OpenRouter LLM provider.  OpenRouter is OpenAI-compatible,
 * so we just point the OpenAI client at https://openrouter.ai/api/v1.
 * Adds the optional OpenRouter-specific headers (HTTP-Referer, X-Title)
 * so Bokari shows up on the OpenRouter leaderboards.
 * @author Amadou — Dicken AI
 * @version 1.0.0
 */
import OpenAI from 'openai';
import OpenAILLM from '../openai/openaiLLM';

type OpenRouterConfig = {
  apiKey: string;
  model: string;
  baseURL?: string;
};

class OpenRouterLLM extends OpenAILLM {
  constructor(protected config: OpenRouterConfig) {
    super({
      apiKey: config.apiKey,
      model: config.model,
      baseURL: config.baseURL ?? 'https://openrouter.ai/api/v1',
    });
    // Add the optional ranking headers — harmless if missing server-side.
    (this as any).openAIClient = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL ?? 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': 'https://bokari.ai',
        'X-Title': 'Bokari',
      },
    });
  }
}

export default OpenRouterLLM;
