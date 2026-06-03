/**
 * @module models/providers/openai/promptCache.test
 * @description Unit tests for the OpenAI prompt-caching helper.
 * @author Amadou — Dicken AI
 */
import { describe, it, expect } from 'vitest';
import OpenAILLM from '@/lib/models/providers/openai/openaiLLM';
import { ChatCompletionMessageParam } from 'openai/resources/index.mjs';

const llm = new OpenAILLM({ apiKey: 'test', model: 'gpt-4o-mini' });

const sysMsg = (s: string): ChatCompletionMessageParam => ({
  role: 'system',
  content: s,
});
const userMsg = (s: string): ChatCompletionMessageParam => ({
  role: 'user',
  content: s,
});
const asstMsg = (s: string): ChatCompletionMessageParam => ({
  role: 'assistant',
  content: s,
});

describe('OpenAILLM.applyPromptCaching', () => {
  it('passes through an empty array', () => {
    expect(llm.applyPromptCaching([])).toEqual([]);
  });

  it('marks the system message as cacheable', () => {
    const out = llm.applyPromptCaching([sysMsg('You are helpful.')]);
    const sys = out[0]!;
    const content = sys.content as Array<{
      type: string;
      text: string;
      cache_control?: { type: string };
    }>;
    expect(Array.isArray(content)).toBe(true);
    expect(content[0]!.cache_control).toEqual({ type: 'ephemeral' });
    expect(content[0]!.text).toBe('You are helpful.');
  });

  it('marks the last non-system message as cacheable', () => {
    const out = llm.applyPromptCaching([
      sysMsg('sys'),
      userMsg('hi'),
      asstMsg('hello'),
      userMsg('bye'),
    ]);
    const last = out[out.length - 1]!;
    const content = last.content as Array<{
      cache_control?: { type: string };
    }>;
    expect(content[0]!.cache_control).toEqual({ type: 'ephemeral' });
  });

  it('leaves middle messages untouched', () => {
    const out = llm.applyPromptCaching([
      sysMsg('sys'),
      userMsg('hi'),
      userMsg('bye'),
    ]);
    const middle = out[1]!;
    expect(typeof middle.content).toBe('string');
    expect(middle.content).toBe('hi');
  });

  it('does not double-mark when there is only a system message', () => {
    const out = llm.applyPromptCaching([sysMsg('only sys')]);
    const sys = out[0]!;
    const content = sys.content as Array<unknown>;
    expect(content.length).toBe(1);
  });

  it('skips empty-string system messages without throwing', () => {
    const out = llm.applyPromptCaching([sysMsg(''), userMsg('hi')]);
    const sys = out[0]!;
    expect(typeof sys.content).toBe('string');
    expect(sys.content).toBe('');
  });
});
