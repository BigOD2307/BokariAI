import { describe, it, expect, vi } from 'vitest';
import {
  checkFaithfulness,
  extractClaims,
  isFaithfulnessEnabled,
} from '@/lib/agents/search/faithfulness';

const sources = [
  {
    id: 'S1',
    passages: [
      'Le budget 2026 du Mali atteint 3 200 milliards de FCFA selon la loi de finances.',
    ],
  },
  {
    id: 'S2',
    passages: ["L'inflation a ralenti au troisième trimestre."],
  },
];

const llmReturning = (results: unknown) =>
  ({
    generateObject: vi.fn(async () => ({ results })),
  }) as any;

describe('faithfulness — claim extraction', () => {
  it('keeps only cited [Sn] sentences long enough to be claims', () => {
    const claims = extractClaims(
      "Le budget 2026 du Mali atteint 3 200 milliards de FCFA selon la loi de finances [S1]. Court. Une phrase sans source qui est assez longue pour compter mais rien à vérifier.",
    );
    expect(claims).toHaveLength(1);
    expect(claims[0]!.sourceIds).toEqual(['S1']);
    expect(claims[0]!.text).not.toContain('[S1]');
  });

  it('dedupes multiple citations on one sentence (order of appearance)', () => {
    const claims = extractClaims(
      "L'inflation a ralenti au troisième trimestre et d'autres faits encore assez longs pour compter [S2][S2][S1].",
    );
    expect(claims[0]!.sourceIds).toEqual(['S2', 'S1']);
  });

  it('returns nothing for empty or uncited answers', () => {
    expect(extractClaims('')).toEqual([]);
    expect(extractClaims('Pas de citations ici. Juste de la prose assez longue.')).toEqual([]);
  });
});

describe('checkFaithfulness', () => {
  it('keeps a supported verdict whose quote is verbatim in the source', async () => {
    const report = await checkFaithfulness(
      'Le budget 2026 du Mali atteint 3 200 milliards de FCFA [S1].',
      sources,
      llmReturning([
        {
          index: 1,
          verdict: 'supported',
          quote: 'Le budget 2026 du Mali atteint 3 200 milliards de FCFA',
        },
      ]),
    );
    expect(report.claims[0]!.verdict).toBe('supported');
    expect(report.claims[0]!.quote).toContain('3 200 milliards');
    expect(report.supported).toBe(1);
  });

  it('downgrades a supported verdict whose quote is NOT in the source', async () => {
    const report = await checkFaithfulness(
      'Le budget 2026 du Mali atteint 3 200 milliards de FCFA [S1].',
      sources,
      llmReturning([
        { index: 1, verdict: 'supported', quote: 'une phrase que personne n a ecrite' },
      ]),
    );
    expect(report.claims[0]!.verdict).toBe('partial');
    expect(report.claims[0]!.quote).toBe('');
  });

  it('treats an unjudged claim as unsupported, never as partial', async () => {
    const report = await checkFaithfulness(
      "L'inflation a ralenti au troisième trimestre selon les données [S2].",
      sources,
      llmReturning([]),
    );
    expect(report.claims[0]!.verdict).toBe('unsupported');
    expect(report.unsupported).toBe(1);
    expect(report.partial).toBe(0);
  });

  it('normalises quotes (whitespace, apostrophes) before verifying', async () => {
    const report = await checkFaithfulness(
      "L'inflation a ralenti au troisième trimestre d'après l'institut [S2].",
      sources,
      llmReturning([
        {
          index: 1,
          verdict: 'supported',
          quote: "L'inflation  a ralenti au troisième   trimestre",
        },
      ]),
    );
    expect(report.claims[0]!.verdict).toBe('supported');
  });

  it('reports unavailability instead of a reassuring zero', async () => {
    const failing = {
      generateObject: vi.fn(async () => {
        throw new Error('502');
      }),
    } as any;
    const report = await checkFaithfulness(
      'Une affirmation assez longue pour compter comme une vérification [S1].',
      sources,
      failing,
    );
    expect(report.unavailable).toBe('502');
    expect(report.supported).toBe(0);
    expect(report.total).toBe(1);
  });

  it('returns an empty report when nothing is checkable (no LLM call)', async () => {
    const llm = { generateObject: vi.fn() } as any;
    const report = await checkFaithfulness('Réponse sans aucune citation.', sources, llm);
    expect(report.total).toBe(0);
    expect(llm.generateObject).not.toHaveBeenCalled();
  });
});

describe('feature flag', () => {
  it('is ON by default, off only with BOKARI_FAITHFULNESS_ENABLED=false', () => {
    const prev = process.env.BOKARI_FAITHFULNESS_ENABLED;
    delete process.env.BOKARI_FAITHFULNESS_ENABLED;
    expect(isFaithfulnessEnabled()).toBe(true);
    process.env.BOKARI_FAITHFULNESS_ENABLED = 'false';
    expect(isFaithfulnessEnabled()).toBe(false);
    process.env.BOKARI_FAITHFULNESS_ENABLED = 'true';
    expect(isFaithfulnessEnabled()).toBe(true);
    if (prev !== undefined) process.env.BOKARI_FAITHFULNESS_ENABLED = prev;
    else delete process.env.BOKARI_FAITHFULNESS_ENABLED;
  });
});
