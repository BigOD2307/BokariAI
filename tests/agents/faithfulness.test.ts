import { describe, it, expect } from 'vitest';
import {
  extractCitedClaims,
  scoreFaithfulness,
  isFaithfulnessEnabled,
  type ClaimVerdict,
} from '@/lib/agents/search/faithfulness';

describe('faithfulness — claim extraction', () => {
  it('keeps only cited sentences, strips markers, dedupes + sorts citations', () => {
    const answer =
      'Le PIB du Sénégal a augmenté de 5% en 2024 [1]. La capitale est Dakar. Le franc CFA est utilisé dans huit pays [2][1].';
    const claims = extractCitedClaims(answer);

    expect(claims).toHaveLength(2); // the uncited "La capitale…" is dropped
    expect(claims[0]!.citations).toEqual([1]);
    expect(claims[0]!.text).toContain('PIB');
    expect(claims[0]!.text).not.toContain('[1]');
    expect(claims[1]!.citations).toEqual([1, 2]); // deduped + sorted
    expect(claims[1]!.text).toContain('franc CFA');
  });

  it('returns nothing for empty or uncited answers', () => {
    expect(extractCitedClaims('')).toEqual([]);
    expect(extractCitedClaims('No citations here. Just prose.')).toEqual([]);
  });
});

describe('faithfulness — scoring', () => {
  const v = (label: ClaimVerdict['label']): ClaimVerdict => ({
    text: 'x',
    citations: [1],
    label,
  });

  it('counts labels and gives partial half credit', () => {
    const report = scoreFaithfulness([
      v('supported'),
      v('partial'),
      v('unsupported'),
    ]);
    expect(report.total).toBe(3);
    expect(report.supported).toBe(1);
    expect(report.partial).toBe(1);
    expect(report.unsupported).toBe(1);
    expect(report.score).toBeCloseTo((1 + 0.5) / 3); // 0.5
  });

  it('treats an all-supported answer as fully faithful', () => {
    const report = scoreFaithfulness([v('supported'), v('supported')]);
    expect(report.score).toBe(1);
  });

  it('returns a neutral report for no cited claims', () => {
    const report = scoreFaithfulness([]);
    expect(report.total).toBe(0);
    expect(report.score).toBe(1);
  });
});

describe('faithfulness — feature flag', () => {
  it('is opt-in via BOKARI_FAITHFULNESS_ENABLED', () => {
    const prev = process.env.BOKARI_FAITHFULNESS_ENABLED;
    process.env.BOKARI_FAITHFULNESS_ENABLED = 'true';
    expect(isFaithfulnessEnabled()).toBe(true);
    process.env.BOKARI_FAITHFULNESS_ENABLED = 'false';
    expect(isFaithfulnessEnabled()).toBe(false);
    delete process.env.BOKARI_FAITHFULNESS_ENABLED;
    expect(isFaithfulnessEnabled()).toBe(false);
    if (prev !== undefined) process.env.BOKARI_FAITHFULNESS_ENABLED = prev;
  });
});
