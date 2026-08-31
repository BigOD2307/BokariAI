import { describe, expect, it, vi, beforeEach } from 'vitest';
import ActionRegistry from '@/lib/agents/search/researcher/actions/registry';
import type { ResearchAction } from '@/lib/agents/search/types';
import type { ToolCall } from '@/lib/models/types';

// A fake action whose execution time depends on its own arguments, so a fast
// call and a slow call can be in flight at once — exactly the condition that
// used to trip BUG-26 (results bound back by array index instead of by id).
const delayedAction: ResearchAction<any> = {
  name: 'delayed',
  schema: {} as any,
  getToolDescription: () => 'test',
  getDescription: () => 'test',
  enabled: () => true,
  execute: async (params: { delayMs: number; label: string }) => {
    await new Promise((resolve) => setTimeout(resolve, params.delayMs));
    return { type: 'search_results', results: [{ content: params.label, metadata: {} }] } as any;
  },
};

describe('ActionRegistry.executeAll — result-to-call binding (BUG-26)', () => {
  beforeEach(() => {
    ActionRegistry.register(delayedAction);
  });

  it('binds each result to its OWN call id, regardless of completion order', async () => {
    const calls: ToolCall[] = [
      { id: 'call-slow', name: 'delayed', arguments: { delayMs: 30, label: 'slow' } },
      { id: 'call-fast', name: 'delayed', arguments: { delayMs: 0, label: 'fast' } },
    ];

    const results = await ActionRegistry.executeAll(calls, {
      llm: {} as any,
      embedding: {} as any,
      session: {} as any,
      researchBlockId: 'rb-1',
      fileIds: [],
      mode: 'balanced',
      sources: ['web'],
      classification: undefined as any,
    });

    // Promise.all preserves INPUT order in the returned array, regardless of
    // which promise actually settled first.
    expect(results).toHaveLength(2);
    expect(results[0].id).toBe('call-slow');
    expect((results[0].output as any).results[0].content).toBe('slow');
    expect(results[1].id).toBe('call-fast');
    expect((results[1].output as any).results[0].content).toBe('fast');
  });
});
