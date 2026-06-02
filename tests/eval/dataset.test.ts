/**
 * @module eval/dataset.test
 * @description Tests for the eval query dataset and relevance grading.
 *
 * @author Amadou — Dicken AI
 */
import { describe, it, expect } from 'vitest';
import { AFRICAN_EVAL_QUERIES, deriveRelevance } from '@/lib/eval/dataset';

describe('AFRICAN_EVAL_QUERIES', () => {
  it('has exactly 23 queries (20 base + 3 adversarial)', () => {
    expect(AFRICAN_EVAL_QUERIES).toHaveLength(23);
  });

  it('every query is non-empty and has a topic', () => {
    for (const q of AFRICAN_EVAL_QUERIES) {
      expect(q.query.length).toBeGreaterThan(0);
      expect(q.topic).toBeTruthy();
    }
  });

  it('every query has notes explaining what it tests', () => {
    for (const q of AFRICAN_EVAL_QUERIES) {
      expect(q.notes).toBeTruthy();
    }
  });
});

describe('deriveRelevance', () => {
  it('returns 3 when the query string is in the title', () => {
    const rel = deriveRelevance(
      { query: 'Bamako Mali' },
      { title: 'Bamako Mali nouveau président', fullContent: 'irrelevant body', topic: 'africa' },
    );
    expect(rel).toBe(3);
  });

  it('returns 1 when the query is only in the body', () => {
    const rel = deriveRelevance(
      { query: 'Bamako Mali' },
      { title: 'Some other title', fullContent: 'Bamako Mali news…', topic: 'africa' },
    );
    expect(rel).toBe(1);
  });

  it('returns 0 when the query is not in title or body', () => {
    const rel = deriveRelevance(
      { query: 'Bamako Mali' },
      { title: 'Lagos news', fullContent: 'Nigeria', topic: 'africa' },
    );
    expect(rel).toBe(0);
  });

  it('enforces topic gate: article from another topic gets 0', () => {
    const rel = deriveRelevance(
      { query: 'Mali election', topic: 'africa' },
      { title: 'Mali election update', fullContent: '', topic: 'tech' },
    );
    expect(rel).toBe(0);
  });

  it('topic gate has a bypass for mustMatch in title (cross-tagged article)', () => {
    const rel = deriveRelevance(
      { query: 'African startups', topic: 'tech', mustMatch: ['African'] },
      { title: 'African startups raise millions', fullContent: '', topic: 'finance' },
    );
    expect(rel).toBe(3);
  });

  it('forbidden terms in title → 0', () => {
    const rel = deriveRelevance(
      { query: 'AI', forbiddenTitle: ['elon musk'] },
      { title: 'Elon Musk AI announcement', fullContent: 'AI news', topic: 'tech' },
    );
    expect(rel).toBe(0);
  });

  it('is case-insensitive', () => {
    const rel = deriveRelevance(
      { query: 'BAMAKO' },
      { title: 'bamako news', fullContent: '', topic: 'africa' },
    );
    expect(rel).toBe(3);
  });
});
