import z from 'zod';
import { Message } from '../types';

type Model = {
  name: string;
  key: string;
};

type ModelList = {
  embedding: Model[];
  chat: Model[];
};

type ProviderMetadata = {
  name: string;
  key: string;
};

type MinimalProvider = {
  id: string;
  name: string;
  chatModels: Model[];
  embeddingModels: Model[];
};

type ModelWithProvider = {
  key: string;
  providerId: string;
};

type GenerateOptions = {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stopSequences?: string[];
  frequencyPenalty?: number;
  presencePenalty?: number;
  /**
   * Usage-accounting label (e.g. a role name like 'classifier'). Recorded by
   * providers that report token usage — see src/lib/ai/usage.ts. Purely
   * observational: never affects the call itself.
   */
  label?: string;
};

/** Token counts for one LLM call, as reported by the provider. */
type TokenUsage = {
  promptTokens: number;
  completionTokens: number;
};

type Tool = {
  name: string;
  description: string;
  schema: z.ZodObject<any>;
};

type ToolCall = {
  id: string;
  name: string;
  arguments: Record<string, any>;
};

type GenerateTextInput = {
  messages: Message[];
  tools?: Tool[];
  options?: GenerateOptions;
};

type GenerateTextOutput = {
  content: string;
  toolCalls: ToolCall[];
  additionalInfo?: Record<string, any>;
  /** Present when the provider reported token counts for this call. */
  usage?: TokenUsage;
};

type StreamTextOutput = {
  contentChunk: string;
  toolCallChunk: ToolCall[];
  /** Native model reasoning ("thinking") delta, when the model emits it
   *  (e.g. DeepSeek V4 / reasoning models via OpenRouter). Surfaced in the
   *  research steps as the "Reflexion" sub-step. Empty for non-reasoning models. */
  reasoningChunk?: string;
  additionalInfo?: Record<string, any>;
  /** Present on the final chunk when the provider reported stream usage
   *  (requires stream_options.include_usage, set by OpenAILLM). */
  usage?: TokenUsage;
  done?: boolean;
};

type GenerateObjectInput = {
  schema: z.ZodTypeAny;
  messages: Message[];
  options?: GenerateOptions;
};

type GenerateObjectOutput<T> = {
  object: T;
  additionalInfo?: Record<string, any>;
  /** Present when the provider reported token counts for this call. */
  usage?: TokenUsage;
};

type StreamObjectOutput<T> = {
  objectChunk: Partial<T>;
  additionalInfo?: Record<string, any>;
  done?: boolean;
};

export type {
  Model,
  ModelList,
  ProviderMetadata,
  MinimalProvider,
  ModelWithProvider,
  GenerateOptions,
  GenerateTextInput,
  GenerateTextOutput,
  StreamTextOutput,
  GenerateObjectInput,
  GenerateObjectOutput,
  StreamObjectOutput,
  TokenUsage,
  Tool,
  ToolCall,
};
