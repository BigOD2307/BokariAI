import { describe, it, expect } from 'vitest';
import {
  appendTurn,
  MAX_HISTORY_ENTRIES,
  MAX_HISTORY_TURNS,
  truncateHistory,
} from '@/lib/utils/chatHistory';

describe('truncateHistory', () => {
  it('returns a copy of short history unchanged (length-wise)', () => {
    const h: [string, string][] = [
      ['human', 'a'],
      ['assistant', 'b'],
    ];
    const out = truncateHistory(h);
    expect(out).toEqual(h);
  });

  it('caps to the last N entries (default 16 = 8 turns)', () => {
    const h: [string, string][] = Array.from({ length: 30 }, (_, i) => [
      i % 2 === 0 ? 'human' : 'assistant',
      `m${i}`,
    ]) as [string, string][];
    const out = truncateHistory(h);
    expect(out).toHaveLength(MAX_HISTORY_ENTRIES);
    expect(out[0]).toEqual(['human', `m${30 - MAX_HISTORY_ENTRIES}`]);
    expect(out[out.length - 1]).toEqual(['assistant', 'm29']);
  });

  it('respects a custom maxEntries', () => {
    const h: [string, string][] = Array.from({ length: 20 }, (_, i) => [
      'human',
      `m${i}`,
    ]) as [string, string][];
    expect(truncateHistory(h, 4)).toHaveLength(4);
    expect(truncateHistory(h, 4)[0]).toEqual(['human', 'm16']);
  });

  it('does not mutate the input', () => {
    const h: [string, string][] = [
      ['human', 'a'],
      ['assistant', 'b'],
      ['human', 'c'],
    ];
    const snapshot = [...h];
    truncateHistory(h, 2);
    expect(h).toEqual(snapshot);
  });

  it('handles empty input', () => {
    expect(truncateHistory([])).toEqual([]);
  });
});

describe('appendTurn', () => {
  it('appends a turn and caps the result', () => {
    const h: [string, string][] = Array.from(
      { length: MAX_HISTORY_ENTRIES },
      (_, i) => ['human', `m${i}`] as [string, string],
    );
    const out = appendTurn(h, ['human', 'new']);
    expect(out).toHaveLength(MAX_HISTORY_ENTRIES);
    expect(out[out.length - 1]).toEqual(['human', 'new']);
    // First entry is the second original, since one was evicted.
    expect(out[0]).toEqual(['human', 'm1']);
  });

  it('returns a new array (never mutates input)', () => {
    const h: [string, string][] = [['human', 'a']];
    const out = appendTurn(h, ['assistant', 'b']);
    expect(out).not.toBe(h);
    expect(h).toEqual([['human', 'a']]);
  });
});

describe('constants', () => {
  it('MAX_HISTORY_TURNS is 8', () => {
    expect(MAX_HISTORY_TURNS).toBe(8);
  });

  it('MAX_HISTORY_ENTRIES = 2 × MAX_HISTORY_TURNS', () => {
    expect(MAX_HISTORY_ENTRIES).toBe(MAX_HISTORY_TURNS * 2);
  });
});
