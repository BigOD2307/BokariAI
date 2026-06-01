/**
 * @module discover/freshness.test
 * @description Tests for the freshness decay scorer.
 */
import { describe, it, expect } from 'vitest';
import { freshnessScore } from '@/lib/discover/freshness';

const ONE_DAY = 24 * 60 * 60 * 1000;

describe('freshnessScore', () => {
  it('returns 1.0 for brand-new content (age=0)', () => {
    expect(freshnessScore(0)).toBe(1);
  });

  it('returns 0.5 at the half-life', () => {
    expect(freshnessScore(3 * ONE_DAY)).toBeCloseTo(0.5, 5);
  });

  it('returns ~0.25 at 2x the half-life', () => {
    expect(freshnessScore(6 * ONE_DAY)).toBeCloseTo(0.25, 5);
  });

  it('returns ~0.125 at 3x the half-life', () => {
    expect(freshnessScore(9 * ONE_DAY)).toBeCloseTo(0.125, 5);
  });

  it('respects a custom half-life', () => {
    // 1-hour half-life: at 2h, score = 0.25
    const oneHour = 60 * 60 * 1000;
    expect(freshnessScore(2 * oneHour, oneHour)).toBeCloseTo(0.25, 5);
  });

  it('never goes below the floor', () => {
    expect(freshnessScore(365 * ONE_DAY)).toBeGreaterThanOrEqual(0.05);
  });

  it('honors a custom floor', () => {
    expect(freshnessScore(365 * ONE_DAY, 3 * ONE_DAY, 0.1)).toBe(0.1);
  });

  it('treats negative age as 0 (future-dated content is "fresh")', () => {
    expect(freshnessScore(-1000)).toBe(1);
  });

  it('is monotonically decreasing', () => {
    const a = freshnessScore(ONE_DAY);
    const b = freshnessScore(2 * ONE_DAY);
    const c = freshnessScore(7 * ONE_DAY);
    expect(a).toBeGreaterThan(b);
    expect(b).toBeGreaterThan(c);
  });

  it('is bounded in [floor, 1]', () => {
    for (const age of [0, ONE_DAY, 30 * ONE_DAY, 365 * ONE_DAY]) {
      const s = freshnessScore(age);
      expect(s).toBeGreaterThanOrEqual(0.05);
      expect(s).toBeLessThanOrEqual(1);
    }
  });
});
