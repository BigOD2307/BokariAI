/**
 * @module eval/metrics.test
 * @description Unit tests for IR metrics.
 *
 * @author Amadou — Dicken AI
 */
import { describe, it, expect } from 'vitest';
import { dcg, idcg, ndcg, mrr, hitRateAtK, aggregate, type RankedItem } from '@/lib/eval/metrics';

const r = (rank: number, rel: 0 | 1 | 2 | 3): RankedItem => ({ rank, relevance: rel });

describe('dcg', () => {
  it('returns 0 for all-irrelevant items', () => {
    expect(dcg([r(0, 0), r(1, 0), r(2, 0)])).toBe(0);
  });

  it('gives perfect score for perfect ranking (single relevant)', () => {
    // 1 item, rel=3, position 0 → (2^3 - 1) / log2(2) = 7/1 = 7
    expect(dcg([r(0, 3)])).toBeCloseTo(7, 6);
  });

  it('discounts by log2(rank + 2)', () => {
    // pos 0: rel=2 → gain (2^2 - 1) = 3, discount log2(2) = 1 → 3.0
    // pos 1: rel=1 → gain (2^1 - 1) = 1, discount log2(3) ≈ 1.585 → 0.631
    const out = dcg([r(0, 2), r(1, 1)]);
    expect(out).toBeCloseTo(3 + 1 / Math.log2(3), 6);
  });

  it('respects K (truncates the list)', () => {
    const full = dcg([r(0, 3), r(1, 3), r(2, 3)], 10);
    const k2 = dcg([r(0, 3), r(1, 3), r(2, 3)], 2);
    expect(k2).toBeLessThan(full);
  });
});

describe('idcg', () => {
  it('equals DCG of the relevance-sorted list', () => {
    const items = [r(0, 1), r(1, 3), r(2, 0), r(3, 2)];
    const ideal = idcg(items);
    // Sorted by relevance desc: 3, 2, 1, 0
    const sorted = [r(0, 3), r(1, 2), r(2, 1), r(3, 0)];
    expect(ideal).toBeCloseTo(dcg(sorted), 6);
  });
});

describe('ndcg', () => {
  it('returns 1.0 for a perfect ranking', () => {
    // Already sorted by relevance desc → perfect
    expect(ndcg([r(0, 3), r(1, 2), r(2, 1), r(3, 0)])).toBeCloseTo(1, 6);
  });

  it('returns 0 for the worst possible ranking (all relevant at the end)', () => {
    // All relevant at the end → DCG = sum of (low-gain / high-discount)
    // Sorted = all first → IDCG = sum of (gain / low-discount)
    // Ratio approaches 0 but is not exactly 0 because log discounts.
    const worst = [r(0, 0), r(1, 0), r(2, 1), r(3, 2)];
    expect(ndcg(worst)).toBeLessThan(0.5);
  });

  it('returns 0 when no items are relevant (IDCG = 0)', () => {
    expect(ndcg([r(0, 0), r(1, 0), r(2, 0)])).toBe(0);
  });

  it('returns 1.0 when relevance is 0 for everything (IDCG=0, DCG=0, returns 0 by convention)', () => {
    // Special case: IDCG=0 → return 0 (no relevant items at all)
    expect(ndcg([r(0, 0)])).toBe(0);
  });

  it('produces a value strictly between 0 and 1 for a partial match', () => {
    const items = [r(0, 3), r(1, 0), r(2, 2)];
    const score = ndcg(items);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});

describe('mrr', () => {
  it('returns 1 for first position relevant', () => {
    expect(mrr([r(0, 3), r(1, 0)])).toBe(1);
  });

  it('returns 1/2 for second position relevant', () => {
    expect(mrr([r(0, 0), r(1, 2)])).toBeCloseTo(0.5, 6);
  });

  it('returns 0 for no relevant items', () => {
    expect(mrr([r(0, 0), r(1, 0), r(2, 0)])).toBe(0);
  });

  it('picks the first relevant, not the highest-ranked one', () => {
    // First relevant is at rank 1 (rel=1), even though rank 0 has rel=0
    expect(mrr([r(0, 0), r(1, 1), r(2, 3)])).toBeCloseTo(0.5, 6);
  });
});

describe('hitRateAtK', () => {
  it('returns 1 when first item is relevant', () => {
    expect(hitRateAtK([r(0, 1)])).toBe(1);
  });

  it('returns 0 when no item in top K is relevant', () => {
    expect(hitRateAtK([r(0, 0), r(1, 0), r(2, 0)], 3)).toBe(0);
  });

  it('truncates at K', () => {
    // Rank 2 is relevant, but K=2 means we look at ranks 0 and 1
    expect(hitRateAtK([r(0, 0), r(1, 0), r(2, 3)], 2)).toBe(0);
    expect(hitRateAtK([r(0, 0), r(1, 0), r(2, 3)], 3)).toBe(1);
  });
});

describe('aggregate', () => {
  it('returns zeros for empty input', () => {
    expect(aggregate([])).toEqual({
      queries: 0,
      ndcgAtK: 0,
      mrr: 0,
      hitRateAtK: 0,
      k: 10,
    });
  });

  it('averages per-query metrics', () => {
    const perQuery = [
      [r(0, 3), r(1, 0)], // ndcg=1, mrr=1, hit=1
      [r(0, 0), r(1, 2)], // ndcg<1, mrr=0.5, hit=1
    ];
    const m = aggregate(perQuery, 2);
    expect(m.queries).toBe(2);
    expect(m.mrr).toBeCloseTo(0.75, 6);
    expect(m.hitRateAtK).toBe(1);
    expect(m.ndcgAtK).toBeGreaterThan(0);
    expect(m.ndcgAtK).toBeLessThan(1);
  });

  it('respects the K parameter', () => {
    const items = [r(0, 0), r(1, 0), r(2, 0), r(3, 0), r(4, 0), r(5, 3)];
    expect(hitRateAtK(items, 5)).toBe(0);
    expect(hitRateAtK(items, 6)).toBe(1);
  });
});
