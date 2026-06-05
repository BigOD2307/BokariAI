import { describe, it, expect } from 'vitest';
import { normaliseQuery, isVolatileQuery } from '@/lib/cache/semantic';

describe('semantic cache — multilingual normalisation', () => {
  it('folds accents so accented/unaccented FR variants collide', () => {
    expect(normaliseQuery('élection présidentielle')).toBe(
      normaliseQuery('election presidentielle'),
    );
  });

  it('collapses different FR question phrasings to the same meaningful tokens', () => {
    const a = normaliseQuery("Qu'est-ce que le franc CFA ?");
    const b = normaliseQuery("C'est quoi le franc CFA");
    expect(a).toBe(b); // both → "cfa franc"
    expect(a).toContain('cfa');
    expect(a).toContain('franc');
  });

  it('ignores word order', () => {
    expect(normaliseQuery('capitale du Sénégal')).toBe(
      normaliseQuery('Sénégal capitale'),
    );
  });
});

describe('semantic cache — freshness classification', () => {
  it('flags time-sensitive queries as volatile (short TTL)', () => {
    expect(isVolatileQuery('résultat élection 2026')).toBe(true);
    expect(isVolatileQuery("le taux de change du CFA aujourd'hui")).toBe(true);
    expect(isVolatileQuery('météo Dakar')).toBe(true);
  });

  it('treats evergreen queries as stable (long TTL)', () => {
    expect(isVolatileQuery("histoire de l'empire du Mali")).toBe(false);
    expect(isVolatileQuery('comment fonctionne le mobile money')).toBe(false);
  });
});
