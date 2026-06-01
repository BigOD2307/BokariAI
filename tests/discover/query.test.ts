/**
 * @module discover/query.test
 * @description Tests for query classification and expansion.
 */
import { describe, it, expect } from 'vitest';
import { classifyQuery, expandQuery, isAfricanContext } from '@/lib/discover/query';

describe('classifyQuery', () => {
  describe('news intent', () => {
    it('detects breaking-news keywords', () => {
      expect(classifyQuery('actualités Mali aujourd\'hui', 'africa')).toBe('news');
    });

    it('detects "match" / "score" for sports news', () => {
      expect(classifyQuery('résultat match Sénégal hier', 'sports')).toBe('news');
    });

    it('detects "election" for political news', () => {
      expect(classifyQuery('élection présidentielle Niger', 'politics')).toBe('news');
    });
  });

  describe('research intent', () => {
    it('detects "comment" / "how"', () => {
      expect(classifyQuery('comment fonctionne la BRVM', 'finance')).toBe('research');
    });

    it('detects "expliquer" / "explique"', () => {
      expect(classifyQuery('explique le fonctionnement du FCFA', 'finance')).toBe('research');
    });

    it('detects "pourquoi"', () => {
      expect(classifyQuery('pourquoi le naira chute', 'finance')).toBe('research');
    });
  });

  describe('local intent', () => {
    it('detects city names', () => {
      expect(classifyQuery('restaurant Bamako', 'africa')).toBe('local');
    });

    it('detects "près de moi" / "near me"', () => {
      expect(classifyQuery('pharmacie près de moi', 'sante')).toBe('local');
    });
  });

  describe('mixed fallback', () => {
    it('returns "mixed" for unclassifiable queries', () => {
      expect(classifyQuery('Bokari', 'tech')).toBe('mixed');
    });

    it('returns "mixed" for empty query', () => {
      expect(classifyQuery('', 'africa')).toBe('mixed');
    });
  });
});

describe('expandQuery', () => {
  it('returns at least the original query', () => {
    const out = expandQuery('IA au Sénégal', 'tech', 'fr');
    expect(out).toContain('IA au Sénégal');
  });

  it('produces 2-4 variants', () => {
    const out = expandQuery('IA au Sénégal', 'tech', 'fr');
    expect(out.length).toBeGreaterThanOrEqual(2);
    expect(out.length).toBeLessThanOrEqual(4);
  });

  it('produces French variants for FR queries', () => {
    const out = expandQuery('intelligence artificielle Sénégal', 'tech', 'fr');
    const allFR = out.every((q) => !/[a-z]{6,}/i.test(q) || q.toLowerCase().includes('intelligence') || q.toLowerCase().includes('senegal'));
    expect(allFR).toBe(true);
  });

  it('produces French variants when lang=en and query has EN terms', () => {
    // When the user types English, we add the FR equivalent as a variant
    // so francophone African sources can be matched.
    const out = expandQuery('artificial intelligence Senegal', 'tech', 'en');
    expect(out.some((q) => q.toLowerCase().includes('intelligence artificielle'))).toBe(true);
  });

  it('handles finance topic specifically', () => {
    const out = expandQuery('BRVM', 'finance', 'fr');
    expect(out.length).toBeGreaterThanOrEqual(2);
    expect(out.some((q) => /bourse|brvm|uemoa/i.test(q))).toBe(true);
  });

  it('handles empty input gracefully', () => {
    const out = expandQuery('', 'africa', 'fr');
    expect(out.length).toBeGreaterThan(0);
  });

  it('does not duplicate identical variants', () => {
    const out = expandQuery('AI Senegal', 'tech', 'en');
    const set = new Set(out);
    expect(set.size).toBe(out.length);
  });
});

describe('isAfricanContext', () => {
  it('detects African country names', () => {
    expect(isAfricanContext('élections au Sénégal')).toBe(true);
    expect(isAfricanContext('Nigeria startups')).toBe(true);
    expect(isAfricanContext('Kenya news')).toBe(true);
  });

  it('detects African capital cities', () => {
    expect(isAfricanContext('Bamako news')).toBe(true);
    expect(isAfricanContext('Dakar weather')).toBe(true);
  });

  it('detects regional keywords', () => {
    expect(isAfricanContext('UEMOA policy')).toBe(true);
    expect(isAfricanContext('BRVM stock')).toBe(true);
    expect(isAfricanContext('African Union summit')).toBe(true);
  });

  it('returns false for non-African queries', () => {
    expect(isAfricanContext('Tesla stock price')).toBe(false);
    expect(isAfricanContext('French elections')).toBe(false);
    expect(isAfricanContext('crypto news')).toBe(false);
  });

  it('handles French and English mixed', () => {
    expect(isAfricanContext('Côte d\'Ivoire')).toBe(true);
  });
});
