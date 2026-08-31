import { describe, expect, it } from 'vitest';
import { summariseActionOutput } from '@/lib/agents/search/researcher/summarise';
import type { ActionOutput } from '@/lib/agents/search/types';

describe('summariseActionOutput', () => {
  it('keeps the researcher prompt bounded regardless of result size (BUG-07)', () => {
    const results = Array.from({ length: 60 }, (_, i) => ({
      content: 'x'.repeat(4_000),
      metadata: { title: `t${i}`, url: `https://d.test/${i}` },
    }));
    const summary = summariseActionOutput({ type: 'search_results', results } as ActionOutput);
    expect(summary.length).toBeLessThan(4_000);
    expect(summary).toContain('+48 autres');
  });

  it('includes the date when present in metadata', () => {
    const results = [
      {
        content: 'contenu',
        metadata: { title: 'Titre', url: 'https://a.test', publishedAt: '2026-06-01T00:00:00.000Z' },
      },
    ];
    const summary = summariseActionOutput({ type: 'search_results', results } as ActionOutput);
    expect(summary).toContain('[2026-06-01]');
  });

  it('omits the date bracket when metadata has no date', () => {
    const results = [{ content: 'contenu', metadata: { title: 'Titre', url: 'https://a.test' } }];
    const summary = summariseActionOutput({ type: 'search_results', results } as ActionOutput);
    expect(summary).not.toContain('[undefined');
  });

  it('truncates each snippet to 150 characters', () => {
    const results = [{ content: 'y'.repeat(1000), metadata: { title: 'T', url: 'https://a.test' } }];
    const summary = summariseActionOutput({ type: 'search_results', results } as ActionOutput);
    expect(summary).not.toContain('y'.repeat(200));
  });

  it('passes non-search-results output through as JSON', () => {
    const output = { type: 'done', reason: 'complete' } as unknown as ActionOutput;
    expect(summariseActionOutput(output)).toBe(JSON.stringify(output));
  });

  it('does not mention omitted results when everything fits', () => {
    const results = Array.from({ length: 5 }, (_, i) => ({
      content: 'contenu',
      metadata: { title: `t${i}`, url: `https://d.test/${i}` },
    }));
    const summary = summariseActionOutput({ type: 'search_results', results } as ActionOutput);
    expect(summary).not.toContain('autres');
  });
});
