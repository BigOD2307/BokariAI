import { describe, it, expect } from 'vitest';
import { pickWriterLlm } from '@/lib/agents/search/routing';

/**
 * Model-tier routing: simple queries should use the fast tier when one is
 * configured; everything else falls back to the default model. The helper is
 * pure (no model loading) so we exercise it with sentinel objects.
 */
describe('search agent — model-tier routing', () => {
  const big = { id: '70b' };
  const fast = { id: '8b' };

  it('routes simple queries to the fast tier when configured', () => {
    expect(pickWriterLlm('simple', big, fast)).toBe(fast);
  });

  it('keeps complex queries on the default model', () => {
    expect(pickWriterLlm('complex', big, fast)).toBe(big);
  });

  it('falls back to the default when no fast tier is configured', () => {
    expect(pickWriterLlm('simple', big, undefined)).toBe(big);
    expect(pickWriterLlm('simple', big, null)).toBe(big);
  });

  it('falls back to the default when complexity is unknown', () => {
    expect(pickWriterLlm(undefined, big, fast)).toBe(big);
  });
});
