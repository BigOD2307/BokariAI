/**
 * @module discover/cosine.test
 * @description Unit tests for the cosine similarity helper.
 * @author Amadou — Dicken AI
 */
import { describe, it, expect } from 'vitest';
import { cosine, cosine01 } from '@/lib/discover/cosine';

describe('cosine', () => {
  it('returns 1 for identical unit vectors', () => {
    expect(cosine([1, 0, 0], [1, 0, 0])).toBeCloseTo(1, 6);
    expect(cosine([0.6, 0.8, 0], [0.6, 0.8, 0])).toBeCloseTo(1, 6);
  });

  it('returns 0 for orthogonal vectors', () => {
    expect(cosine([1, 0, 0], [0, 1, 0])).toBeCloseTo(0, 6);
  });

  it('returns -1 for opposite vectors', () => {
    expect(cosine([1, 0], [-1, 0])).toBeCloseTo(-1, 6);
  });

  it('is scale-invariant (only direction matters)', () => {
    expect(cosine([2, 0, 0], [5, 0, 0])).toBeCloseTo(1, 6);
    expect(cosine([1, 2, 3], [2, 4, 6])).toBeCloseTo(1, 6);
  });

  it('returns 0 for zero vectors', () => {
    expect(cosine([0, 0, 0], [0, 0, 0])).toBe(0);
    expect(cosine([0, 0, 0], [1, 2, 3])).toBe(0);
  });

  it('returns 0 for mismatched lengths', () => {
    expect(cosine([1, 2], [1, 2, 3])).toBe(0);
  });

  it('returns 0 for empty vectors', () => {
    expect(cosine([], [])).toBe(0);
  });

  it('returns 0 for non-finite inputs', () => {
    expect(cosine([Infinity, 0], [1, 0])).toBe(0);
    expect(cosine([NaN, 0], [1, 0])).toBe(0);
    expect(cosine([1, 0], [NaN, 0])).toBe(0);
  });

  it('matches a hand-computed similarity', () => {
    // a = [3, 1, 2], b = [2, 1, 0]
    // dot = 6 + 1 + 0 = 7
    // |a| = sqrt(9+1+4) = sqrt(14)
    // |b| = sqrt(4+1+0) = sqrt(5)
    // sim = 7 / (sqrt(14) * sqrt(5)) = 7 / sqrt(70) ≈ 0.83666
    expect(cosine([3, 1, 2], [2, 1, 0])).toBeCloseTo(0.83666, 4);
  });
});

describe('cosine01', () => {
  it('maps -1 → 0 and 1 → 1', () => {
    expect(cosine01(-1)).toBe(0);
    expect(cosine01(1)).toBe(1);
  });

  it('maps 0 → 0.5', () => {
    expect(cosine01(0)).toBe(0.5);
  });

  it('maps interior values linearly', () => {
    expect(cosine01(0.5)).toBeCloseTo(0.75, 6);
    expect(cosine01(-0.5)).toBeCloseTo(0.25, 6);
  });

  it('clamps out-of-range values', () => {
    expect(cosine01(2)).toBe(1);
    expect(cosine01(-5)).toBe(0);
  });

  it('returns 0 for non-finite', () => {
    expect(cosine01(NaN)).toBe(0);
    expect(cosine01(Infinity)).toBe(0);
  });
});
