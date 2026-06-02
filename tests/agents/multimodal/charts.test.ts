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
});
