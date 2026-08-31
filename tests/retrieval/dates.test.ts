import { describe, expect, it } from 'vitest';
import { parsePublishedAt } from '@/lib/retrieval/dates';

describe('parsePublishedAt', () => {
  const now = new Date('2026-08-30T12:00:00Z');

  it.each([
    ['2 days ago', 2 * 86_400_000],
    ['1 hour ago', 3_600_000],
    ['3 weeks ago', 3 * 604_800_000],
  ])('parses "%s" as a relative offset', (input, deltaMs) => {
    expect(parsePublishedAt(input, now)?.getTime()).toBe(now.getTime() - deltaMs);
  });

  it('parses an ISO date', () => {
    expect(parsePublishedAt('2026-06-01', now)?.getFullYear()).toBe(2026);
  });

  it.each(['', 'demain', '12', 'n/a', '3'])('returns null for %p', (input) => {
    expect(parsePublishedAt(input, now)).toBeNull();
  });

  it('returns null for null/undefined input', () => {
    expect(parsePublishedAt(null, now)).toBeNull();
    expect(parsePublishedAt(undefined, now)).toBeNull();
  });

  it('rejects a date more than a day in the future (clock skew guard)', () => {
    expect(parsePublishedAt('2099-01-01', now)).toBeNull();
  });

  it('rejects a year before 1990', () => {
    expect(parsePublishedAt('1985-01-01', now)).toBeNull();
  });
});
