/**
 * Weekly auto-update of "L'Afrique en chiffres".
 *
 * For each auto-eligible stat: search the web, ask the LLM to extract the
 * current numeric value (in the expected unit) and which result it came from,
 * sanity-check it against the def's [min, max] bounds, and only then overwrite
 * the stored value — with the real source URL the figure came from. A figure
 * that's missing, unparseable, or out of bounds is left untouched (the seed /
 * previous value stays). This is the guard-rail that keeps a hallucinated
 * number off a public stats page.
 */
import type { Message } from '@/lib/types';
import { chatWithFallback } from '@/lib/ai/gateway';
import { searchSearxng } from '@/lib/search';
import { getAutoStatDefs, type StatDef } from './schema';
import { setStat, touchChecked } from './store';

export type StatsUpdateSummary = {
  updated: number;
  unchanged: number;
  rejected: number;
  errors: number;
  details: string[];
};

function extractNumber(s: string): number | null {
  // First number, tolerant of FR formatting ("1 400,5" / "4,8" / "12.3%").
  const m = s.replace(/ /g, ' ').match(/-?\d[\d  .]*(?:[.,]\d+)?/);
  if (!m) return null;
  const cleaned = m[0]
    .replace(/[  ]/g, '')
    .replace(/\.(?=\d{3}\b)/g, '') // thousands dot
    .replace(',', '.');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

async function refreshOne(def: StatDef): Promise<'updated' | 'unchanged' | 'rejected' | 'error'> {
  let results: { title: string; url: string; content?: string }[] = [];
  try {
    const r = await searchSearxng(def.query as string);
    results = r.results.slice(0, 6);
  } catch {
    return 'error';
  }
  if (results.length === 0) return 'error';

  const numbered = results
    .map((r, i) => `[${i + 1}] ${r.title}\n${(r.content ?? '').slice(0, 400)}`)
    .join('\n\n');

  const messages: Message[] = [
    {
      role: 'system',
      content: `Tu extrais une valeur chiffrée factuelle à partir d'extraits web. Réponds STRICTEMENT en JSON : {"numeric": number|null, "sourceIndex": number|null}. La valeur doit être exprimée dans l'unité demandée (ex: millions, milliards de dollars, ou pourcentage sans le signe). Mets null si les extraits ne permettent pas de répondre avec certitude. N'invente jamais.`,
    },
    {
      role: 'user',
      content: `Donnée recherchée : ${def.query}\n\nExtraits :\n\n${numbered}\n\nJSON uniquement.`,
    },
  ];

  let content = '';
  try {
    const res = await chatWithFallback(
      (model) => model.generateText({ messages, options: { temperature: 0, maxTokens: 160 } }),
      `stat:${def.key}`,
    );
    content = res.content ?? '';
  } catch {
    return 'error';
  }

  let numeric: number | null = null;
  let sourceIndex: number | null = null;
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      const parsed = JSON.parse(content.slice(start, end + 1));
      numeric = typeof parsed.numeric === 'number' ? parsed.numeric : extractNumber(String(parsed.numeric ?? ''));
      sourceIndex = typeof parsed.sourceIndex === 'number' ? parsed.sourceIndex : null;
    } catch {
      numeric = extractNumber(content);
    }
  } else {
    numeric = extractNumber(content);
  }

  if (numeric === null) {
    await touchChecked(def.key);
    return 'unchanged';
  }

  if (numeric < (def.min as number) || numeric > (def.max as number)) {
    // Implausible — keep the existing value.
    await touchChecked(def.key);
    return 'rejected';
  }

  const sourceUrl =
    (sourceIndex && results[sourceIndex - 1]?.url) || results[0]?.url || null;
  const value = def.format!(numeric);
  await setStat(def, value, numeric, sourceUrl);
  return 'updated';
}

export async function updateAfricaStats(): Promise<StatsUpdateSummary> {
  const defs = getAutoStatDefs();
  const summary: StatsUpdateSummary = {
    updated: 0,
    unchanged: 0,
    rejected: 0,
    errors: 0,
    details: [],
  };

  // Sequential with a tiny pause — this runs weekly, no need to hammer search.
  for (const def of defs) {
    try {
      const outcome = await refreshOne(def);
      if (outcome === 'updated') summary.updated += 1;
      else if (outcome === 'unchanged') summary.unchanged += 1;
      else if (outcome === 'rejected') summary.rejected += 1;
      else summary.errors += 1;
      summary.details.push(`${def.key}: ${outcome}`);
    } catch (err) {
      summary.errors += 1;
      summary.details.push(`${def.key}: error ${(err as Error)?.message ?? err}`);
    }
  }
  return summary;
}
