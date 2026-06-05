/**
 * @module agents/search/richBlocks
 * @description Intent gates + structured extraction for rich in-chat
 *   illustration blocks — a Comparison Table, an Entity/Knowledge Card, and a
 *   Fact-Check Verdict (the category-defining trust block for an African
 *   fact-check product).
 *
 *   Mirrors the chart pipeline (agents/multimodal/charts.ts): a cheap regex
 *   gate decides whether to spend one LLM extraction call, the extractor
 *   returns strict JSON, and a coercer validates a CONFIDENCE GATE — failing
 *   CLOSED to `null` so the prose answer always stands. The whole layer is
 *   opt-in behind BOKARI_RICH_BLOCKS_ENABLED at the call site.
 *
 *   Parsing/coercion is pure (no network) and unit-tested without API keys.
 */
import type { LlmCallable, ChartSource } from '@/lib/agents/multimodal/charts';
import type {
  ComparisonTableSpec,
  EntityCardSpec,
  EntityAttribute,
  VerdictSpec,
  VerdictLabel,
} from '@/lib/types/multimodal';

/** A ranked search finding handed to an extractor as evidence. */
export type RichSource = ChartSource; // { id, title, content }

/** Whether the rich illustration extraction layer is enabled (opt-in). */
export function isRichBlocksEnabled(): boolean {
  return process.env.BOKARI_RICH_BLOCKS_ENABLED === 'true';
}

/* ------------------------------------------------------------------ *
 * Intent gates — pure regex, French + English. A gate only decides
 * whether it is worth spending one extractor LLM call.
 * ------------------------------------------------------------------ */

const COMPARISON_PATTERNS: RegExp[] = [
  /\bvs\.?\b/i,
  /\bversus\b/i,
  /\bcompar(?:er|aison|e|ez|ons)\b/i,
  /\bcompared?\b/i,
  /\bdiff[ée]rences?\s+entre\b/i,
  /\b\w+\s+ou\s+\w+\s*\?/i,
  /\bmeilleur[e]?\b[^\n]{0,40}\bou\b/i,
];

export function looksLikeComparisonRequest(query: string): boolean {
  if (!query || typeof query !== 'string') return false;
  return COMPARISON_PATTERNS.some((p) => p.test(query));
}

const ENTITY_PATTERNS: RegExp[] = [
  /\bqui est\b/i,
  /\bqui sont\b/i,
  /\bc'?est quoi\b/i,
  /\bqu'?est[- ]ce que?\b/i,
  /\bwho is\b/i,
  /\bwhat is\b/i,
  /\bpr[ée]sente[rz]?\b/i,
  /\bparle[- ]moi de\b/i,
  /\bbiographie\b/i,
];

export function looksLikeEntityRequest(query: string): boolean {
  if (!query || typeof query !== 'string') return false;
  return ENTITY_PATTERNS.some((p) => p.test(query));
}

const VERDICT_PATTERNS: RegExp[] = [
  /\best[- ]?(?:il|elle|ce)?\s+vrai\b/i,
  /\bc'?est vrai\b/i,
  /\bvrai ou faux\b/i,
  /\bis it true\b/i,
  /\bfact[- ]?check\b/i,
  /\b(rumeur|intox|d[ée]sinformation|fake news|canular)\b/i,
];

export function looksLikeVerdictRequest(query: string): boolean {
  if (!query || typeof query !== 'string') return false;
  return VERDICT_PATTERNS.some((p) => p.test(query));
}

/* ------------------------------------------------------------------ *
 * Shared helpers
 * ------------------------------------------------------------------ */

function genId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function sourcesBlock(sources: RichSource[]): string {
  return sources
    .slice(0, 8)
    .map((s) => `[${s.id}] ${s.title}\n${s.content.slice(0, 600)}`)
    .join('\n\n');
}

/** Run one structured-JSON extraction call. Never throws; returns the parsed
 *  JSON value or null on any LLM/parse failure (fail-closed). */
async function extractJson(
  systemPrompt: string,
  query: string,
  sources: RichSource[],
  llm: LlmCallable,
): Promise<unknown | null> {
  if (sources.length === 0) return null;
  const userPrompt = `Question: ${query}\n\nSources:\n${sourcesBlock(sources)}`;
  let res: { content: string };
  try {
    res = await llm.call([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);
  } catch {
    return null;
  }
  try {
    return JSON.parse(res.content);
  } catch {
    return null;
  }
}

function asRecord(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

/* ------------------------------------------------------------------ *
 * Comparison table
 * ------------------------------------------------------------------ */

const COMPARISON_SYSTEM = `Tu extrais un tableau comparatif a partir des sources. Reponds UNIQUEMENT en JSON valide:
{ "title"?: string, "columns": string[], "rows": (string|number)[][], "highlightCol"?: number }
- "columns" = en-tetes (le premier est le critere compare, ex: "Critere", puis une colonne par option).
- "rows" = une ligne par critere, chaque ligne a autant de cellules que de colonnes.
- "highlightCol" = index (0-base) de la colonne a mettre en avant si une option ressort, sinon omets.
Si la question n'est pas une comparaison claire avec des donnees tabulables, reponds {"columns": []}.`;

export function coerceComparisonTable(
  raw: unknown,
  sources: RichSource[],
): ComparisonTableSpec | null {
  const r = asRecord(raw);
  if (!r) return null;
  const columns = Array.isArray(r.columns)
    ? r.columns.filter((c): c is string => typeof c === 'string')
    : [];
  if (columns.length < 2) return null;
  const rows = Array.isArray(r.rows)
    ? r.rows
        .filter((row): row is unknown[] => Array.isArray(row))
        .map((row) =>
          row.map((cell) =>
            typeof cell === 'number' ? cell : String(cell ?? ''),
          ),
        )
    : [];
  if (rows.length < 1) return null;
  return {
    id: genId('cmp'),
    kind: 'comparison_table',
    title: typeof r.title === 'string' ? r.title : undefined,
    columns,
    rows,
    highlightCol:
      typeof r.highlightCol === 'number' &&
      r.highlightCol >= 0 &&
      r.highlightCol < columns.length
        ? r.highlightCol
        : undefined,
    sourceIds: sources.slice(0, 3).map((s) => s.id),
  };
}

export async function extractComparisonTable(
  query: string,
  sources: RichSource[],
  llm: LlmCallable,
): Promise<ComparisonTableSpec | null> {
  const parsed = await extractJson(COMPARISON_SYSTEM, query, sources, llm);
  return coerceComparisonTable(parsed, sources);
}

/* ------------------------------------------------------------------ *
 * Entity / knowledge card
 * ------------------------------------------------------------------ */

const ENTITY_SYSTEM = `Tu extrais une fiche d'entite (personne, lieu, organisation, concept) a partir des sources. Reponds UNIQUEMENT en JSON valide:
{ "name": string, "entityType"?: string, "summary": string, "attributes": [{ "label": string, "value": string }], "image"?: string }
- "attributes" = faits cles (ex: "Naissance", "Fonction", "Pays"). Fournis-en au moins 2.
- "summary" = 1 a 2 phrases.
Si aucune entite claire ne ressort des sources, reponds {"name": ""}.`;

export function coerceEntityCard(
  raw: unknown,
  sources: RichSource[],
): EntityCardSpec | null {
  const r = asRecord(raw);
  if (!r) return null;
  const name = typeof r.name === 'string' ? r.name.trim() : '';
  if (!name) return null;
  const attributes: EntityAttribute[] = Array.isArray(r.attributes)
    ? r.attributes
        .map((a) => asRecord(a))
        .filter(
          (a): a is Record<string, unknown> =>
            !!a && typeof a.label === 'string' && typeof a.value === 'string',
        )
        .map((a) => ({ label: a.label as string, value: a.value as string }))
    : [];
  if (attributes.length < 2) return null;
  return {
    id: genId('ent'),
    kind: 'entity_card',
    name,
    entityType: typeof r.entityType === 'string' ? r.entityType : undefined,
    image:
      typeof r.image === 'string' && /^https?:\/\//.test(r.image)
        ? r.image
        : undefined,
    summary: typeof r.summary === 'string' ? r.summary : '',
    attributes,
    sourceIds: sources.slice(0, 3).map((s) => s.id),
  };
}

export async function extractEntityCard(
  query: string,
  sources: RichSource[],
  llm: LlmCallable,
): Promise<EntityCardSpec | null> {
  const parsed = await extractJson(ENTITY_SYSTEM, query, sources, llm);
  return coerceEntityCard(parsed, sources);
}

/* ------------------------------------------------------------------ *
 * Fact-check verdict
 * ------------------------------------------------------------------ */

const VALID_VERDICTS: VerdictLabel[] = [
  'vrai',
  'faux',
  'trompeur',
  'non_verifie',
];

const VERDICT_LABEL_FR: Record<VerdictLabel, string> = {
  vrai: 'Vrai',
  faux: 'Faux',
  trompeur: 'Trompeur',
  non_verifie: 'Non vérifié',
};

const VERDICT_SYSTEM = `Tu es un verificateur de faits. Evalue l'affirmation UNIQUEMENT a partir des sources fournies. Reponds UNIQUEMENT en JSON valide:
{ "claim": string, "verdict": "vrai"|"faux"|"trompeur"|"non_verifie", "confidence": number, "summary": string }
- "claim" = l'affirmation reformulee brievement.
- "verdict" = "non_verifie" si les sources ne permettent pas de trancher.
- "confidence" = nombre entre 0 et 1.
- "summary" = une phrase justifiant le verdict en t'appuyant sur les sources.
N'invente jamais: en cas de doute, "non_verifie".`;

export function coerceVerdict(
  raw: unknown,
  sources: RichSource[],
  fallbackClaim: string,
): VerdictSpec | null {
  const r = asRecord(raw);
  if (!r) return null;
  const verdict = r.verdict;
  if (
    typeof verdict !== 'string' ||
    !VALID_VERDICTS.includes(verdict as VerdictLabel)
  ) {
    return null;
  }
  // Trust gate: no unsourced verdicts.
  const sourceIds = sources.slice(0, 3).map((s) => s.id);
  if (sourceIds.length < 1) return null;
  const claim =
    typeof r.claim === 'string' && r.claim.trim() ? r.claim.trim() : fallbackClaim;
  const rawConf = typeof r.confidence === 'number' ? r.confidence : 0.5;
  const confidence = Math.max(0, Math.min(1, rawConf));
  return {
    id: genId('vdt'),
    kind: 'verdict',
    claim,
    verdict: verdict as VerdictLabel,
    verdictLabel: VERDICT_LABEL_FR[verdict as VerdictLabel],
    confidence,
    summary: typeof r.summary === 'string' ? r.summary : '',
    sourceIds,
  };
}

export async function extractVerdict(
  query: string,
  sources: RichSource[],
  llm: LlmCallable,
): Promise<VerdictSpec | null> {
  const parsed = await extractJson(VERDICT_SYSTEM, query, sources, llm);
  return coerceVerdict(parsed, sources, query);
}
