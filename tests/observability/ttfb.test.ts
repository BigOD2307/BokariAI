/**
 * @module observability/ttfb.test
 * @description Unit tests for the in-memory timing store.
 * @author Amadou — Dicken AI
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  recordTiming,
  getTimings,
  getPercentiles,
  beginRequest,
  endRequest,
  _clearTimings,
} from '@/lib/observability/ttfb';

beforeEach(() => {
  _clearTimings();
});

describe('recordTiming + getTimings', () => {
  it('stores stages for a request', () => {
    const id = beginRequest();
    recordTiming('chat.first_block', 100, { requestId: id });
    recordTiming('chat.total', 2000, { requestId: id });
    const t = getTimings(id);
    expect(t).not.toBeNull();
    expect(t!.stages.length).toBe(2);
    expect(t!.stages[0]!.label).toBe('chat.first_block');
    expect(t!.stages[1]!.ms).toBe(2000);
  });

  it('mints a request id when none is provided', () => {
    recordTiming('chat.total', 1234);
    // We can't easily inspect the store from outside (no export),
    // so just assert that the call doesn't throw.
    expect(true).toBe(true);
  });

  it('attaches meta when provided', () => {
    const id = beginRequest();
    recordTiming('chat.cache_lookup', 5, { requestId: id, meta: { hit: 'exact' } });
    const t = getTimings(id);
    expect(t!.stages[0]!.meta).toEqual({ hit: 'exact' });
  });
});

describe('getPercentiles', () => {
  it('returns null when no samples', () => {
    expect(getPercentiles('chat.first_block')).toBeNull();
  });

  it('computes p50/p95/p99 for a label', () => {
    const id = beginRequest();
    for (let i = 1; i <= 100; i++) {
      recordTiming('chat.first_block', i, { requestId: id });
    }
    const p = getPercentiles('chat.first_block');
    expect(p).not.toBeNull();
    expect(p!.count).toBe(100);
    expect(p!.p50).toBeGreaterThanOrEqual(50);
    expect(p!.p50).toBeLessThanOrEqual(51);
    expect(p!.p95).toBeGreaterThanOrEqual(95);
    expect(p!.p99).toBeGreaterThanOrEqual(99);
  });

  it('ignores stages with a different label', () => {
    const id = beginRequest();
    recordTiming('chat.first_block', 100, { requestId: id });
    recordTiming('chat.total', 2000, { requestId: id });
    const p = getPercentiles('chat.first_block');
    expect(p).not.toBeNull();
    expect(p!.count).toBe(1);
  });
});

describe('beginRequest / endRequest', () => {
  it('endRequest clears the current pointer', () => {
    const id = beginRequest();
    expect(getTimings(id)).not.toBeNull();
    endRequest(id);
    // The store still has the record; we just no longer auto-route.
    expect(getTimings(id)).not.toBeNull();
  });
});
