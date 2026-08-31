import z from 'zod';
import {
  GenerateObjectInput,
  GenerateOptions,
  GenerateTextInput,
  GenerateTextOutput,
  StreamTextOutput,
} from '../types';
import { Message } from '@/lib/types';

abstract class BaseLLM<CONFIG> {
  constructor(protected config: CONFIG) {}
  abstract generateText(input: GenerateTextInput): Promise<GenerateTextOutput>;
  abstract streamText(
    input: GenerateTextInput,
  ): AsyncGenerator<StreamTextOutput>;
  abstract generateObject<T>(input: GenerateObjectInput): Promise<z.infer<T>>;
  abstract streamObject<T>(
    input: GenerateObjectInput,
  ): AsyncGenerator<Partial<z.infer<T>>>;

  /**
   * Single-shot completion returning raw text.
   *
   * This is the `LlmCallable` contract that the chart, rich-block and Learn
   * extractors have always assumed (see `src/lib/agents/multimodal/charts.ts`).
   * It was never implemented, so every one of those features silently produced
   * nothing — their `catch` blocks swallowed the resulting TypeError.
   *
   * Defaults to a low temperature because every current caller asks for JSON.
   */
  async call(
    messages: Message[],
    options?: GenerateOptions,
  ): Promise<{ content: string }> {
    const { content } = await this.generateText({
      messages,
      options: { temperature: 0.1, ...options },
    });
    return { content };
  }
}

export default BaseLLM;
