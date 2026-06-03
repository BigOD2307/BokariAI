/**
 * @module agents/multimodal/charts
 * @description Chart intent detection + structured spec extraction.
 *   `looksLikeChartRequest` is a pure regex check used to short-circuit
 *   the path: only when the user asks for a visualisation do we burn an
 *   LLM call to extract the data.  `extractChartSpec` runs the LLM and
 *   parses the JSON response into a ChartSpec.
 *
 * @author Amadou — Dicken AI
 * @version 1.0.0
 */

import type { ChartSpec, ChartKind } from '@/lib/types/multimodal';

const CHART_TRIGGER_PATTERNS: RegExp[] = [
  /\b(graph(?:e|ique|iques)?|chart)\b/i,
  /\b(comparer?|comparaison|comparison)\b/i,
  /\b(PIB|GDP|revenu|taux|prix)\b[^\n]{0,40}\b(par|entre|selon|of|by)\b/i,
  /\b([eé]volution|progression|tendance|trend|trajectoire)\b/i,
  /\b(statistiques?|donn[ée]es?|chiffres?)\b/i,
  /\b(r[ée]partition|distribution|part de march[ée])\b/i,
  /\b(top\s?\d+|classement|palmarès|hit parade)\b/i,
];

export function looksLikeChartRequest(query: string): boolean {
  if (!query || typeof query !== 'string') return false;
  return CHART_TRIGGER_PATTERNS.some((p) => p.test(query));
}

export interface ChartSource {
  id: number;
  title: string;
  content: string;
}

const VALID_KINDS: ChartKind[] = [
  'bar',
  'line',
  'area',
  'pie',
  'radar',
  'scatter',
  'composed',
];

export interface LlmCallable {
  call: (messages: Array<{ role: string; content: string }>) => Promise<{
    content: string;
  }>;
}

export async function extractChartSpec(
  query: string,
  sources: ChartSource[],
  llm: LlmCallable,
): Promise<ChartSpec | null> {
  if (sources.length === 0) return null;
  const systemPrompt = `Tu extrais des donn\u00e9es structur\u00e9es pour g\u00e9n\u00e9rer un graphique. R\u00e9ponds UNIQUEMENT en JSON valide avec ce sch\u00e9ma:\n{ "kind": "bar"|"line"|"area"|"pie"|"radar", "title": string, "xKey": string, "series": [{ "name": string, "color"?: string }], "data": [{ "xKeyValue": number|string, "series1": number, ... }], "unit"?: string, "caption"?: string }\nSi la requ\u00eate n'a pas de donn\u00e9es tabulables claires, r\u00e9ponds {"kind": null}.`;

  const sourcesBlock = sources
    .slice(0, 8)
    .map(
      (s) =>
        `[${s.id}] ${s.title}\n${s.content.slice(0, 600)}`,
    )
    .join('\n\n');

  const userPrompt = `Question: ${query}\n\nSources:\n${sourcesBlock}`;

  const res = await llm.call([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]);

  let parsed: unknown;
  try {
    parsed = JSON.parse(res.content);
  } catch {
    return null;
  }
  return coerceChartSpec(parsed, sources);
}

function coerceChartSpec(
  raw: unknown,
  sources: ChartSource[],
): ChartSpec | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const kind = r.kind;
  if (typeof kind !== 'string' || !VALID_KINDS.includes(kind as ChartKind)) {
    return null;
  }
  const xKey = typeof r.xKey === 'string' ? r.xKey : null;
  if (!xKey) return null;
  const series = Array.isArray(r.series)
    ? r.series.filter(
        (s): s is { name: string; color?: string } =>
          typeof s === 'object' &&
          s !== null &&
          typeof (s as { name?: unknown }).name === 'string',
      )
    : [];
  if (series.length === 0) return null;
  const data = Array.isArray(r.data)
    ? r.data.filter(
        (d): d is Record<string, string | number> =>
          typeof d === 'object' && d !== null,
      )
    : [];
  if (data.length === 0) return null;

  return {
    id: `chart_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    kind: kind as ChartKind,
    title: typeof r.title === 'string' ? r.title : 'Graphique',
    xKey,
    series,
    data,
    caption: typeof r.caption === 'string' ? r.caption : undefined,
    unit: typeof r.unit === 'string' ? r.unit : undefined,
    sourceIds: sources.slice(0, 3).map((s) => s.id),
  };
}
