/**
 * @module tests/youtube/id
 * @description Pure tests for YouTube id extraction + citation formatting.
 */
import { describe, it, expect } from 'vitest';
import {
  extractVideoId,
  findVideoIdInText,
  citationLink,
  formatTimestamp,
} from '@/lib/youtube/id';

describe('youtube/id extractVideoId', () => {
  it('extracts from watch?v=', () => {
    expect(extractVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(
      'dQw4w9WgXcQ',
    );
  });
  it('extracts from youtu.be short link', () => {
    expect(extractVideoId('https://youtu.be/dQw4w9WgXcQ?t=30')).toBe(
      'dQw4w9WgXcQ',
    );
  });
  it('extracts from /embed/ and /shorts/', () => {
    expect(extractVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe(
      'dQw4w9WgXcQ',
    );
    expect(extractVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe(
      'dQw4w9WgXcQ',
    );
  });
  it('accepts a bare 11-char id', () => {
    expect(extractVideoId('dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });
  it('returns null for non-youtube input', () => {
    expect(extractVideoId('https://example.com/article')).toBeNull();
    expect(extractVideoId('')).toBeNull();
  });
});

describe('youtube/id findVideoIdInText', () => {
  it('finds a youtube URL embedded in a sentence', () => {
    expect(
      findVideoIdInText(
        'Peux-tu résumer https://www.youtube.com/watch?v=dQw4w9WgXcQ stp',
      ),
    ).toBe('dQw4w9WgXcQ');
  });
  it('does NOT match a bare 11-char token (avoids false positives)', () => {
    // "abcdefghijk" is 11 chars but there is no youtube URL → null.
    expect(findVideoIdInText('résume ceci: abcdefghijk merci')).toBeNull();
  });
  it('returns null when no youtube reference', () => {
    expect(findVideoIdInText('quelle est la météo à Dakar')).toBeNull();
  });
});

describe('youtube/id citationLink + formatTimestamp', () => {
  it('builds youtu.be/<id>?t=<seconds> with floored seconds', () => {
    expect(citationLink('dQw4w9WgXcQ', 95.8)).toBe(
      'https://youtu.be/dQw4w9WgXcQ?t=95',
    );
  });
  it('clamps negative time to 0', () => {
    expect(citationLink('dQw4w9WgXcQ', -5)).toBe(
      'https://youtu.be/dQw4w9WgXcQ?t=0',
    );
  });
  it('formats [mm:ss] and [h:mm:ss]', () => {
    expect(formatTimestamp(0)).toBe('[00:00]');
    expect(formatTimestamp(75)).toBe('[01:15]');
    expect(formatTimestamp(3661)).toBe('[1:01:01]');
  });
});
