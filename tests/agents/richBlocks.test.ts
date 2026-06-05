import { describe, it, expect } from 'vitest';
import {
  looksLikeComparisonRequest,
  looksLikeEntityRequest,
  looksLikeVerdictRequest,
  coerceComparisonTable,
  coerceEntityCard,
  coerceVerdict,
  extractComparisonTable,
  extractVerdict,
  type RichSource,
} from '@/lib/agents/search/richBlocks';
import type { LlmCallable } from '@/lib/agents/multimodal/charts';

const SOURCES: RichSource[] = [
  { id: 1, title: 'Source A', content: 'contenu A '.repeat(20) },
  { id: 2, title: 'Source B', content: 'contenu B '.repeat(20) },
];

/** A canned LLM returning fixed JSON, or throwing, for deterministic tests. */
const llmReturning = (content: string): LlmCallable => ({
  call: async () => ({ content }),
});
const llmThrowing = (): LlmCallable => ({
  call: async () => {
    throw new Error('LLM down');
  },
});

describe('richBlocks — intent gates (FR + EN)', () => {
  it('detects comparison requests', () => {
    expect(looksLikeComparisonRequest('Wave vs Orange Money')).toBe(true);
    expect(looksLikeComparisonRequest('compare le CFA et l euro')).toBe(true);
    expect(looksLikeComparisonRequest('Dakar ou Abidjan ?')).toBe(true);
    expect(looksLikeComparisonRequest('qui est Macky Sall')).toBe(false);
  });

  it('detects entity requests', () => {
    expect(looksLikeEntityRequest('qui est Macky Sall')).toBe(true);
    expect(looksLikeEntityRequest("c'est quoi le franc CFA")).toBe(true);
    expect(looksLikeEntityRequest('who is Sadio Mané')).toBe(true);
    expect(looksLikeEntityRequest('combien font 2+2')).toBe(false);
  });

  it('detects verdict / fact-check requests', () => {
    expect(looksLikeVerdictRequest('est-il vrai que le CFA disparaît ?')).toBe(
      true,
    );
    expect(looksLikeVerdictRequest('vrai ou faux : ...')).toBe(true);
    expect(looksLikeVerdictRequest('is it true that ...')).toBe(true);
    expect(looksLikeVerdictRequest('météo Dakar')).toBe(false);
  });
});

describe('richBlocks — comparison table coercion', () => {
  it('accepts a valid table and stamps an id + sourceIds', () => {
    const spec = coerceComparisonTable(
      {
        title: 'Wave vs Orange Money',
        columns: ['Critère', 'Wave', 'Orange Money'],
        rows: [
          ['Frais', '1%', '1.5%'],
          ['Pays', 7, 17],
        ],
        highlightCol: 1,
      },
      SOURCES,
    );
    expect(spec).not.toBeNull();
    expect(spec!.kind).toBe('comparison_table');
    expect(spec!.columns).toHaveLength(3);
    expect(spec!.rows).toHaveLength(2);
    expect(spec!.highlightCol).toBe(1);
    expect(spec!.id).toMatch(/^cmp_/);
    expect(spec!.sourceIds).toEqual([1, 2]);
  });

  it('rejects <2 columns or 0 rows (confidence gate)', () => {
    expect(coerceComparisonTable({ columns: ['x'], rows: [['a']] }, SOURCES)).toBeNull();
    expect(coerceComparisonTable({ columns: ['a', 'b'], rows: [] }, SOURCES)).toBeNull();
    expect(coerceComparisonTable({ columns: [] }, SOURCES)).toBeNull();
  });

  it('extractComparisonTable returns null on malformed JSON', async () => {
    const spec = await extractComparisonTable('a vs b', SOURCES, llmReturning('not json'));
    expect(spec).toBeNull();
  });
});

describe('richBlocks — entity card coercion', () => {
  it('accepts name + >=2 attributes', () => {
    const spec = coerceEntityCard(
      {
        name: 'Macky Sall',
        entityType: 'Personnalité politique',
        summary: 'Ancien président du Sénégal.',
        attributes: [
          { label: 'Naissance', value: '1961' },
          { label: 'Fonction', value: 'Président (2012–2024)' },
        ],
      },
      SOURCES,
    );
    expect(spec).not.toBeNull();
    expect(spec!.kind).toBe('entity_card');
    expect(spec!.attributes).toHaveLength(2);
    expect(spec!.id).toMatch(/^ent_/);
  });

  it('rejects missing name or <2 attributes', () => {
    expect(coerceEntityCard({ name: '', attributes: [] }, SOURCES)).toBeNull();
    expect(
      coerceEntityCard({ name: 'X', attributes: [{ label: 'a', value: 'b' }] }, SOURCES),
    ).toBeNull();
  });

  it('drops a non-http image', () => {
    const spec = coerceEntityCard(
      {
        name: 'X',
        summary: 's',
        image: 'javascript:alert(1)',
        attributes: [
          { label: 'a', value: 'b' },
          { label: 'c', value: 'd' },
        ],
      },
      SOURCES,
    );
    expect(spec!.image).toBeUndefined();
  });
});

describe('richBlocks — verdict coercion (trust gate)', () => {
  it('accepts a valid verdict in the enum with sources', () => {
    const spec = coerceVerdict(
      { claim: 'Le CFA disparaît demain', verdict: 'faux', confidence: 0.9, summary: 'Aucune source ne le confirme.' },
      SOURCES,
      'fallback',
    );
    expect(spec).not.toBeNull();
    expect(spec!.verdict).toBe('faux');
    expect(spec!.verdictLabel).toBe('Faux');
    expect(spec!.sourceIds).toEqual([1, 2]);
    expect(spec!.id).toMatch(/^vdt_/);
  });

  it('rejects a verdict outside the closed enum', () => {
    expect(
      coerceVerdict({ verdict: 'maybe', summary: 's' }, SOURCES, 'q'),
    ).toBeNull();
  });

  it('rejects a verdict with no sources (no unsourced verdicts)', () => {
    expect(coerceVerdict({ verdict: 'vrai', summary: 's' }, [], 'q')).toBeNull();
  });

  it('falls back to the query as the claim and clamps confidence', () => {
    const spec = coerceVerdict(
      { verdict: 'non_verifie', confidence: 5, summary: 's' },
      SOURCES,
      'ma question',
    );
    expect(spec!.claim).toBe('ma question');
    expect(spec!.confidence).toBe(1);
  });
});

describe('richBlocks — coercers + extractors are defensive', () => {
  it('coercers never throw on null / array / non-object', () => {
    for (const bad of [null, undefined, 42, 'x', [], [1, 2]]) {
      expect(() => coerceComparisonTable(bad, SOURCES)).not.toThrow();
      expect(() => coerceEntityCard(bad, SOURCES)).not.toThrow();
      expect(() => coerceVerdict(bad, SOURCES, 'q')).not.toThrow();
      expect(coerceComparisonTable(bad, SOURCES)).toBeNull();
    }
  });

  it('extractors return null when the LLM throws', async () => {
    expect(await extractVerdict('est-ce vrai ?', SOURCES, llmThrowing())).toBeNull();
  });

  it('extractors return null when there are no sources', async () => {
    expect(await extractComparisonTable('a vs b', [], llmReturning('{}'))).toBeNull();
  });
});
