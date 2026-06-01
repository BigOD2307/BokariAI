/**
 * @module ai/embed-helpers.test
 * @description Tests for the articleToEmbedText helper.
 * @author Amadou — Dicken AI
 */
import { describe, it, expect } from 'vitest';
import { articleToEmbedText } from '@/lib/ai/gateway';

describe('articleToEmbedText', () => {
  it('repeats the title when there is no body', () => {
    expect(articleToEmbedText('Bamako election', null)).toBe(
      'Bamako election\nBamako election',
    );
    expect(articleToEmbedText('Bamako election', '')).toBe(
      'Bamako election\nBamako election',
    );
  });

  it('puts title twice then body', () => {
    expect(articleToEmbedText('Bamako election', 'Some body text')).toBe(
      'Bamako election\nBamako election\nSome body text',
    );
  });

  it('truncates body to maxBodyChars', () => {
    const long = 'x'.repeat(5000);
    const out = articleToEmbedText('title', long, 100);
    // title(2 lines) + body(100 chars) — verify body is capped
    const parts = out.split('\n');
    expect(parts).toHaveLength(3);
    expect(parts[2]).toHaveLength(100);
  });

  it('returns empty string for empty input', () => {
    expect(articleToEmbedText('', null)).toBe('');
    expect(articleToEmbedText('   ', '   ')).toBe('');
  });

  it('trims whitespace from title and body', () => {
    const out = articleToEmbedText('  title  ', '  body  ');
    expect(out).toBe('title\ntitle\nbody');
  });
});
