/**
 * @module agents/multimodal/charts.test
 * @description Unit tests for chart intent detection and spec extraction.
 *   Covers the regex detector (FR + EN queries) and the JSON-coercing
 *   LLM extraction path.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  looksLikeChartRequest,
  extractChartSpec,
  type ChartSource,
  type LlmCallable,
} from '@/lib/agents/multimodal/charts';

describe('looksLikeChartRequest', () => {
  it('detects "graphique" trigger', () => {
    expect(looksLikeChartRequest('Fais un graphique de la population')).toBe(
      true,
    );
  });

  it('detects "compare" trigger', () => {
    expect(looksLikeChartRequest('Compare le PIB par pays')).toBe(true);
  });

  it('detects "PIB par pays" combination', () => {
    expect(looksLikeChartRequest("Quel est le PIB par pays ?")).toBe(true);
  });

  it('detects "évolution" trigger', () => {
    expect(looksLikeChartRequest("Quelle est l'Evolution du Bitcoin ?")).toBe(
      true,
    );
  });

  it('detects "statistiques" trigger', () => {
    expect(looksLikeChartRequest('Donne-moi les statistiques')).toBe(true);
  });

  it('detects English chart trigger', () => {
    expect(looksLikeChartRequest('Show me a chart of revenue')).toBe(true);
  });

  it('returns false for a non-chart question', () => {
    expect(looksLikeChartRequest('Qui est le pr\u00e9sident du Mali ?')).toBe(
      false,
    );
  });

  it('returns false for empty input', () => {
    expect(looksLikeChartRequest('')).toBe(false);
  });

  it('handles non-string input safely', () => {
    expect(
      looksLikeChartRequest(null as unknown as string),
    ).toBe(false);
    expect(
      looksLikeChartRequest(undefined as unknown as string),
    ).toBe(false);
  });

  it('detects "top 10" trigger', () => {
    expect(looksLikeChartRequest('Donne-moi le top 10 des villes')).toBe(true);
  });

  it('detects "répartition" trigger', () => {
    expect(looksLikeChartRequest('Répartition de la population')).toBe(true);
  });

  it('detects "repartition" without accent', () => {
    expect(looksLikeChartRequest('Repartition des revenus')).toBe(true);
  });
});

describe('extractChartSpec', () => {
  const sources: ChartSource[] = [
    {
      id: 1,
      title: 'PIB 2024',
      content: 'Mali 17B, Senegal 28B, Cote d Ivoire 70B',
    },
    {
      id: 2,
      title: 'Population 2024',
      content: 'Mali 22M, Senegal 17M, Cote d Ivoire 28M',
    },
  ];

  function fakeLlm(answer: string): LlmCallable {
    return {
      call: vi.fn().mockResolvedValue({ content: answer }),
    };
  }

  it('extracts a valid bar chart spec', async () => {
    const llm = fakeLlm(
      JSON.stringify({
        kind: 'bar',
        title: 'PIB par pays',
        xKey: 'pays',
        series: [{ name: 'PIB' }],
        data: [
          { pays: 'Mali', PIB: 17 },
          { pays: 'Senegal', PIB: 28 },
        ],
        unit: 'B USD',
      }),
    );
    const spec = await extractChartSpec('PIB par pays', sources, llm);
    expect(spec).not.toBeNull();
    expect(spec?.kind).toBe('bar');
    expect(spec?.xKey).toBe('pays');
    expect(spec?.data).toHaveLength(2);
    expect(spec?.unit).toBe('B USD');
    expect(spec?.sourceIds).toEqual([1, 2]);
  });

  it('returns null when the LLM signals no chart', async () => {
    const llm = fakeLlm(JSON.stringify({ kind: null }));
    const spec = await extractChartSpec('q', sources, llm);
    expect(spec).toBeNull();
  });

  it('returns null on invalid JSON', async () => {
    const llm = fakeLlm('not json');
    const spec = await extractChartSpec('q', sources, llm);
    expect(spec).toBeNull();
  });

  it('returns null when kind is unknown', async () => {
    const llm = fakeLlm(
      JSON.stringify({
        kind: 'bubble',
        title: 't',
        xKey: 'x',
        series: [{ name: 'a' }],
        data: [{ x: 1, a: 2 }],
      }),
    );
    const spec = await extractChartSpec('q', sources, llm);
    expect(spec).toBeNull();
  });

  it('returns null when sources are empty', async () => {
    const llm = fakeLlm('{}');
    const spec = await extractChartSpec('q', [], llm);
    expect(spec).toBeNull();
  });

  it('passes system + user messages to the LLM', async () => {
    const llm = fakeLlm(
      JSON.stringify({
        kind: 'line',
        title: 't',
        xKey: 'year',
        series: [{ name: 'v' }],
        data: [{ year: 2020, v: 1 }],
      }),
    );
    await extractChartSpec('question', sources, llm);
    expect(llm.call).toHaveBeenCalledOnce();
    const msgs = (llm.call as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as Array<{ role: string; content: string }>;
    expect(msgs[0]?.role).toBe('system');
    expect(msgs[1]?.role).toBe('user');
    expect(msgs[1]?.content).toContain('question');
  });

  it('returns null when xKey is missing', async () => {
    const llm = fakeLlm(
      JSON.stringify({
        kind: 'bar',
        title: 't',
        series: [{ name: 'v' }],
        data: [{ v: 1 }],
      }),
    );
    const spec = await extractChartSpec('q', sources, llm);
    expect(spec).toBeNull();
  });

  it('returns null when series is empty', async () => {
    const llm = fakeLlm(
      JSON.stringify({
        kind: 'bar',
        title: 't',
        xKey: 'x',
        series: [],
        data: [{ x: 1 }],
      }),
    );
    const spec = await extractChartSpec('q', sources, llm);
    expect(spec).toBeNull();
  });

  it('returns null when data is empty', async () => {
    const llm = fakeLlm(
      JSON.stringify({
        kind: 'bar',
        title: 't',
        xKey: 'x',
        series: [{ name: 'v' }],
        data: [],
      }),
    );
    const spec = await extractChartSpec('q', sources, llm);
    expect(spec).toBeNull();
  });

  it('attaches sourceIds from the first three sources', async () => {
    const manySources: ChartSource[] = [
      { id: 10, title: 'a', content: 'a' },
      { id: 20, title: 'b', content: 'b' },
      { id: 30, title: 'c', content: 'c' },
      { id: 40, title: 'd', content: 'd' },
    ];
    const llm = fakeLlm(
      JSON.stringify({
        kind: 'bar',
        title: 't',
        xKey: 'x',
        series: [{ name: 'v' }],
        data: [{ x: 1, v: 2 }],
      }),
    );
    const spec = await extractChartSpec('q', manySources, llm);
    expect(spec?.sourceIds).toEqual([10, 20, 30]);
  });
});
