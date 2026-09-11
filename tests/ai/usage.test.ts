import { describe, it, expect, beforeEach } from 'vitest';
import { recordUsage, summarizeUsage, resetUsage } from '@/lib/ai/usage';

beforeEach(() => {
  resetUsage();
});

describe('recordUsage', () => {
  it('ignores empty or missing usage (never records a zero row)', () => {
    recordUsage({ label: 'writer', model: 'm', usage: undefined });
    recordUsage({
      label: 'writer',
      model: 'm',
      usage: { promptTokens: 0, completionTokens: 0 },
    });
    expect(summarizeUsage(0).events).toBe(0);
  });

  it('never throws on garbage input', () => {
    expect(() =>
      recordUsage({
        label: undefined,
        model: undefined,
        usage: { promptTokens: -5, completionTokens: NaN } as any,
      }),
    ).not.toThrow();
  });

  it('defaults missing label/model to unknown', () => {
    recordUsage({ usage: { promptTokens: 10, completionTokens: 5 } });
    const s = summarizeUsage(0);
    expect(s.byLabel.unknown.calls).toBe(1);
    expect(s.byModel.unknown.calls).toBe(1);
  });
});

describe('summarizeUsage', () => {
  it('aggregates totals, by model and by label', () => {
    recordUsage({
      label: 'writer',
      model: 'deepseek/deepseek-v4-flash',
      usage: { promptTokens: 1000, completionTokens: 500 },
    });
    recordUsage({
      label: 'classifier',
      model: 'deepseek/deepseek-v4-flash',
      usage: { promptTokens: 2000, completionTokens: 100 },
    });
    recordUsage({
      label: 'writer',
      model: 'llama-3.3-70b-versatile',
      usage: { promptTokens: 500, completionTokens: 500 },
    });

    const s = summarizeUsage(0);
    expect(s.events).toBe(3);
    expect(s.total.calls).toBe(3);
    expect(s.total.promptTokens).toBe(3500);
    expect(s.total.completionTokens).toBe(1100);
    expect(s.byLabel.writer.calls).toBe(2);
    expect(s.byLabel.classifier.totalTokens).toBe(2100);
    expect(s.byModel['deepseek/deepseek-v4-flash'].calls).toBe(2);
  });

  it('prices deepseek v4 flash and treats unknown models as unpriced (0, not free-looking)', () => {
    recordUsage({
      label: 'writer',
      model: 'deepseek/deepseek-v4-flash',
      usage: { promptTokens: 1_000_000, completionTokens: 1_000_000 },
    });
    // 1M in @ $0.10 + 1M out @ $0.20 = $0.30
    expect(summarizeUsage(0).total.estimatedCostUsd).toBeCloseTo(0.3);

    resetUsage();
    recordUsage({
      label: 'writer',
      model: 'some-future-model',
      usage: { promptTokens: 1_000_000, completionTokens: 1_000_000 },
    });
    expect(summarizeUsage(0).total.estimatedCostUsd).toBe(0);
  });

  it('respects the time window', async () => {
    recordUsage({
      label: 'writer',
      model: 'm',
      usage: { promptTokens: 100, completionTokens: 0 },
    });
    expect(summarizeUsage(24).events).toBe(1);
    expect(summarizeUsage(0).events).toBe(1);
    // A 0-hour window excludes everything recorded even a millisecond ago.
    // (windowHours=0 means "all retained" by convention — documented.)
  });

  it('caps the ring (oldest-first eviction)', () => {
    for (let i = 0; i < 5_100; i++) {
      recordUsage({
        label: 'x',
        model: 'm',
        usage: { promptTokens: 1, completionTokens: 0 },
      });
    }
    const s = summarizeUsage(0);
    expect(s.events).toBeLessThanOrEqual(5_000);
    expect(s.total.promptTokens).toBe(s.events);
  });
});
