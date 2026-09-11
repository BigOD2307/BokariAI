/**
 * LLM usage accounting (C-optimisation, vague 2).
 *
 * Every OpenAI-compatible provider call (OpenRouter primary, Groq fallback —
 * both extend OpenAILLM) reports its token counts here. The tracker is a
 * bounded in-memory ring: it answers "what does each question cost, per model
 * and per role" without a database table, a migration, or any per-request
 * overhead beyond pushing one small object.
 *
 * Two deliberate limits:
 *  - In-memory only: counters reset on redeploy. This is an operations
 *    dashboard ("which mode/role burns tokens"), not billing — the quota
 *    system in Postgres stays the source of truth for access control.
 *  - Only providers that report usage record anything. Anthropic/Gemini/local
 *    adapters that don't surface counts yet simply don't appear; a missing
 *    row means "unmeasured", never "free".
 */
import type { TokenUsage } from '@/lib/models/types';

export type UsageEvent = {
  ts: number;
  label: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
};

/** Ring capacity: ~a day of chat traffic at current volume, then oldest-first. */
const MAX_EVENTS = 5_000;

const events: UsageEvent[] = [];

/** Record one provider-reported call. Never throws — accounting must not break answers. */
export function recordUsage(input: {
  label?: string;
  model?: string;
  usage?: TokenUsage | null;
}): void {
  try {
    const promptTokens = Math.max(
      0,
      Math.floor(input.usage?.promptTokens ?? 0),
    );
    const completionTokens = Math.max(
      0,
      Math.floor(input.usage?.completionTokens ?? 0),
    );
    if (promptTokens === 0 && completionTokens === 0) return;
    events.push({
      ts: Date.now(),
      label: input.label || 'unknown',
      model: input.model || 'unknown',
      promptTokens,
      completionTokens,
    });
    if (events.length > MAX_EVENTS) {
      events.splice(0, events.length - MAX_EVENTS);
    }
  } catch {
    /* accounting is best-effort by design */
  }
}

export type UsageSlice = {
  calls: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
};

export type UsageSummary = {
  windowHours: number;
  events: number;
  total: UsageSlice;
  byModel: Record<string, UsageSlice>;
  byLabel: Record<string, UsageSlice>;
};

/**
 * $/1M tokens, verified against provider pricing pages 2026-09. Update when
 * the configured models change — unknown models price at 0 (shown as
 * "unpriced", not as free).
 */
const PRICE_PER_MTOK: Record<string, { in: number; out: number }> = {
  'deepseek/deepseek-v4-flash': { in: 0.1, out: 0.2 },
  'llama-3.3-70b-versatile': { in: 0, out: 0 },
  'llama-3.1-8b-instant': { in: 0, out: 0 },
  'baai/bge-m3': { in: 0.01, out: 0 },
};

function priceOf(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const p = PRICE_PER_MTOK[model];
  if (!p) return 0;
  return (promptTokens * p.in + completionTokens * p.out) / 1_000_000;
}

function sliceOf(list: UsageEvent[]): UsageSlice {
  let promptTokens = 0;
  let completionTokens = 0;
  let estimatedCostUsd = 0;
  for (const e of list) {
    promptTokens += e.promptTokens;
    completionTokens += e.completionTokens;
    estimatedCostUsd += priceOf(e.model, e.promptTokens, e.completionTokens);
  }
  return {
    calls: list.length,
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    estimatedCostUsd,
  };
}

/** Aggregate events from the last `windowHours` (0 = all retained). Pure. */
export function summarizeUsage(windowHours = 24): UsageSummary {
  const cutoff = windowHours > 0 ? Date.now() - windowHours * 3_600_000 : 0;
  const inWindow = events.filter((e) => e.ts >= cutoff);

  const byModel: Record<string, UsageSlice> = {};
  const byLabel: Record<string, UsageSlice> = {};
  for (const e of inWindow) {
    byModel[e.model] ??= {
      calls: 0,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      estimatedCostUsd: 0,
    };
    byLabel[e.label] ??= {
      calls: 0,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      estimatedCostUsd: 0,
    };
  }
  for (const model of Object.keys(byModel)) {
    byModel[model] = sliceOf(inWindow.filter((e) => e.model === model));
  }
  for (const label of Object.keys(byLabel)) {
    byLabel[label] = sliceOf(inWindow.filter((e) => e.label === label));
  }

  return {
    windowHours,
    events: inWindow.length,
    total: sliceOf(inWindow),
    byModel,
    byLabel,
  };
}

/** Test seam: clear the ring. */
export function resetUsage(): void {
  events.length = 0;
}
