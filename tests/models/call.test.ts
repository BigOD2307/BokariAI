import { describe, expect, it, vi } from 'vitest';
import BaseLLM from '@/lib/models/base/llm';

class Fake extends BaseLLM<{}> {
  generateText = vi.fn(async () => ({ content: '{"ok":true}', toolCalls: [] }));
  streamText = async function* () {} as any;
  generateObject = async () => ({}) as any;
  streamObject = async function* () {} as any;
}

describe('BaseLLM.call', () => {
  it('satisfies the LlmCallable contract the extractors rely on', async () => {
    const llm = new Fake({});
    await expect(llm.call([{ role: 'user', content: 'x' }])).resolves.toEqual({
      content: '{"ok":true}',
    });
  });

  it('defaults to a low temperature and lets callers override it', async () => {
    const llm = new Fake({});
    await llm.call([{ role: 'user', content: 'x' }]);
    expect(llm.generateText).toHaveBeenCalledWith(
      expect.objectContaining({ options: { temperature: 0.1 } }),
    );
    await llm.call([{ role: 'user', content: 'x' }], { temperature: 0.7 });
    expect(llm.generateText).toHaveBeenLastCalledWith(
      expect.objectContaining({ options: { temperature: 0.7 } }),
    );
  });
});

describe('LlmCallable regression (BUG-03/08)', () => {
  // The extractors used to call `llm.call(...)` against the real BaseLLM,
  // which had no such method — the TypeError was swallowed by each
  // extractor's own catch, so charts/verdicts/flashcards silently produced
  // nothing for months. Existing tests didn't catch it because they stubbed
  // a fake object that already had `call`. This exercises the REAL BaseLLM.
  it('extractChartSpec works against a real BaseLLM instance', async () => {
    const { extractChartSpec } = await import('@/lib/agents/multimodal/charts');
    class FakeChartLLM extends BaseLLM<{}> {
      generateText = vi.fn(async () => ({
        content: JSON.stringify({
          kind: 'bar',
          title: 'Population',
          xKey: 'country',
          series: [{ name: 'pop' }],
          data: [{ country: 'ML', pop: 22 }],
        }),
        toolCalls: [],
      }));
      streamText = async function* () {} as any;
      generateObject = async () => ({}) as any;
      streamObject = async function* () {} as any;
    }
    const spec = await extractChartSpec(
      'Graphique de la population du Sahel',
      [{ id: 1, title: 'Source', content: 'Mali: 22M' }],
      new FakeChartLLM({}),
    );
    expect(spec).not.toBeNull();
    expect(spec?.kind).toBe('bar');
  });
});
