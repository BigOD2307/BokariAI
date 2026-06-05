/**
 * @module tests/youtube/comprehend
 * @description Pure tests for transcript chunking + comprehension. The embed
 * function is injected as a deterministic stub so the long-video ranking path
 * is fully offline.
 */
import { describe, it, expect } from 'vitest';
import {
  chunkTranscript,
  stuffChunks,
  comprehendTranscript,
} from '@/lib/agents/media/comprehend';
import type { TranscriptSegment } from '@/lib/youtube/types';

/** Build N segments, one per `step` seconds. */
const makeSegments = (n: number, step = 5): TranscriptSegment[] =>
  Array.from({ length: n }, (_, i) => ({
    text: `segment ${i}`,
    start: i * step,
    duration: step,
  }));

describe('comprehend/chunkTranscript', () => {
  it('groups segments into ~window-second windows carrying startTime', () => {
    // 12 segments × 5s = 60s of content; 45s window → 2 windows.
    const chunks = chunkTranscript(makeSegments(12, 5), { windowSeconds: 45 });
    expect(chunks).toHaveLength(2);
    expect(chunks[0].startTime).toBe(0);
    // Second window starts at the first segment past the 45s boundary (45s).
    expect(chunks[1].startTime).toBe(45);
    expect(chunks[0].text).toContain('segment 0');
  });

  it('collapses an untimed (flat) transcript into a single window', () => {
    const flat: TranscriptSegment[] = [
      { text: 'tout le texte', start: 0, duration: 0 },
    ];
    const chunks = chunkTranscript(flat);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].startTime).toBe(0);
  });

  it('returns [] for empty input', () => {
    expect(chunkTranscript([])).toEqual([]);
  });
});

describe('comprehend/stuffChunks', () => {
  it('prefixes each window with an [mm:ss] marker', () => {
    const out = stuffChunks([
      { text: 'intro', startTime: 0, endTime: 5 },
      { text: 'suite', startTime: 75, endTime: 80 },
    ]);
    expect(out).toContain('[00:00] intro');
    expect(out).toContain('[01:15] suite');
  });
});

describe('comprehend/comprehendTranscript', () => {
  const stubEmbed = async (texts: string[]): Promise<number[][]> =>
    // Deterministic vectors: encode the segment index in dim 0 so cosine is
    // predictable. The query (first text) is tuned to match "segment 20".
    texts.map((t) => {
      const m = t.match(/segment (\d+)/);
      const idx = m ? Number(m[1]) : 20; // query → target index 20
      return [idx, 1];
    });

  it('SHORT video → stuff strategy, all chunks kept, citations are youtu.be?t=', async () => {
    const res = await comprehendTranscript(
      'dQw4w9WgXcQ',
      'résumé',
      makeSegments(6, 5), // 30s → 1 chunk at 45s window
      stubEmbed,
      { windowSeconds: 45 },
    );
    expect(res.strategy).toBe('stuff');
    expect(res.chunks.length).toBeGreaterThan(0);
    expect(res.chunks[0].citation).toBe('https://youtu.be/dQw4w9WgXcQ?t=0');
    expect(res.context).toContain('[00:00]');
  });

  it('LONG video → rank strategy, keeps top-k by cosine, chronological order', async () => {
    // 100 segments × 5s = 500s; 45s window → ~12 windows > stuffThreshold 5.
    const res = await comprehendTranscript(
      'dQw4w9WgXcQ',
      'segment 20', // query embeds to idx 20 → window containing it scores high
      makeSegments(100, 5),
      stubEmbed,
      { windowSeconds: 45, stuffThreshold: 5, topK: 3 },
    );
    expect(res.strategy).toBe('rank');
    expect(res.chunks).toHaveLength(3);
    // Citations all deep-link with a ?t= timestamp.
    for (const c of res.chunks) {
      expect(c.citation).toMatch(/^https:\/\/youtu\.be\/dQw4w9WgXcQ\?t=\d+$/);
    }
    // Kept chunks are sorted chronologically.
    const starts = res.chunks.map((c) => c.startTime);
    expect([...starts].sort((a, b) => a - b)).toEqual(starts);
  });
});
