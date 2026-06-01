/**
 * @module discover/bm25.test
 * @description Tests for the BM25 scorer.
 */
import { describe, it, expect } from 'vitest';
import { tokenize, bm25Score, buildBM25Index } from '@/lib/discover/bm25';

describe('tokenize', () => {
  it('lowercases', () => {
    expect(tokenize('BONJOUR')).toEqual(['bonjour']);
  });

  it('splits on whitespace', () => {
    expect(tokenize('a b c')).toEqual(['a', 'b', 'c']);
  });

  it('strips diacritics', () => {
    expect(tokenize('Sénégal')).toEqual(['senegal']);
  });

  it('removes punctuation', () => {
    expect(tokenize('Bamako, Mali.')).toEqual(['bamako', 'mali']);
  });

  it('folds African IPA characters', () => {
    expect(tokenize('Bamakɔ')).toEqual(['bamako']);
    expect(tokenize('kɔnɔ')).toEqual(['kono']);
  });

  it('keeps apostrophes inside words', () => {
    expect(tokenize("N'yɛ")).toEqual(["n'ye"]);
  });

  it('returns [] for empty input', () => {
    expect(tokenize('')).toEqual([]);
  });

  it('returns [] for whitespace only', () => {
    expect(tokenize('   \n\t  ')).toEqual([]);
  });
});

describe('bm25Score', () => {
  it('returns 0 for empty query', () => {
    expect(bm25Score([], ['bamako'], new Map(), 1, 1.5, 0.75)).toBe(0);
  });

  it('returns 0 for empty doc', () => {
    const idf = new Map([['bamako', 1]]);
    expect(bm25Score(['bamako'], [], idf, 0, 1.5, 0.75)).toBe(0);
  });

  it('scores higher when term appears multiple times in doc', () => {
    const idf = new Map([['africa', 1]]);
    const oneOccurrence = bm25Score(['africa'], ['africa', 'news', 'today'], idf, 3, 1.5, 0.75);
    const twoOccurrences = bm25Score(['africa'], ['africa', 'africa', 'news'], idf, 3, 1.5, 0.75);
    expect(twoOccurrences).toBeGreaterThan(oneOccurrence);
  });

  it('scores higher for rare terms (higher IDF)', () => {
    // Both terms appear once in the doc.  Only the IDF differs.
    const doc = ['rare', 'common', 'word'];
    // 'rare' has higher IDF than 'common' — same document, same TF.
    const idf = new Map([['rare', 5], ['common', 0.5]]);
    const rareScore = bm25Score(['rare'], doc, idf, 3, 1.5, 0.75);
    const commonScore = bm25Score(['common'], doc, idf, 3, 1.5, 0.75);
    expect(rareScore).toBeGreaterThan(commonScore);
  });

  it('handles multiple query terms additively', () => {
    const idf = new Map([['africa', 2], ['tech', 2]]);
    const oneTerm = bm25Score(['africa'], ['africa', 'tech', 'news'], idf, 3, 1.5, 0.75);
    const twoTerms = bm25Score(['africa', 'tech'], ['africa', 'tech', 'news'], idf, 3, 1.5, 0.75);
    expect(twoTerms).toBeGreaterThan(oneTerm);
  });

  it('handles term frequency saturation (k1=1.5 default)', () => {
    const idf = new Map([['x', 1]]);
    const one = bm25Score(['x'], ['x', 'a', 'b'], idf, 3, 1.5, 0.75);
    const tenTimes = bm25Score(['x'], ['x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'a'], idf, 11, 1.5, 0.75);
    // 10x more occurrences should not yield 10x the score
    expect(tenTimes / one).toBeLessThan(5);
  });

  it('returns a finite number for any input', () => {
    const idf = new Map([['test', 1]]);
    const score = bm25Score(['test'], ['test'], idf, 1, 1.5, 0.75);
    expect(Number.isFinite(score)).toBe(true);
    expect(Number.isNaN(score)).toBe(false);
  });
});

describe('buildBM25Index', () => {
  it('returns idf and avgdl for a corpus', () => {
    const docs = [
      ['bamako', 'mali', 'news'],
      ['dakar', 'senegal', 'news'],
      ['lagos', 'nigeria', 'tech'],
    ];
    const idx = buildBM25Index(docs);
    expect(idx.idf).toBeInstanceOf(Map);
    expect(idx.avgdl).toBe(3);
  });

  it('gives higher IDF to rare terms', () => {
    const docs = [
      ['africa', 'africa', 'africa'],
      ['africa', 'africa', 'mali'],
      ['africa', 'senegal', 'dakar'],
      ['nigeria', 'lagos', 'tech'],
    ];
    const idx = buildBM25Index(docs);
    // 'mali' appears in 1 doc, 'africa' appears in 3, 'dakar' in 1
    expect(idx.idf.get('mali')!).toBeGreaterThan(idx.idf.get('africa')!);
  });

  it('handles empty corpus', () => {
    const idx = buildBM25Index([]);
    expect(idx.idf.size).toBe(0);
    expect(idx.avgdl).toBe(0);
  });

  it('handles single-doc corpus', () => {
    const idx = buildBM25Index([['one', 'two']]);
    expect(idx.avgdl).toBe(2);
    // Single-doc IDF can be high but finite
    for (const idf of idx.idf.values()) {
      expect(Number.isFinite(idf)).toBe(true);
    }
  });
});
