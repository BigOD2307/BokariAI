/**
 * @module observability/ttfb
 * @description Latency observability for `/api/chat` and the agent
 * hot path.  Layers on top of `latence.ts` (which is a fire-and-forget
 * logger) with two extra capabilities:
 *
 *   1. **In-memory timing store** keyed by `requestId` — every stage
 *      emits a record `{ label, ms, ts }` we can query later.
 *   2. **Percentile helpers** so we can answer "what's our p50 / p95
 *      time-to-first-block this week?" without a metrics backend.
 *
 * The store is bounded (LRU) so it can't leak memory in long-running
 * processes.  The "current request" can be set via `beginRequest` /
 * `endRequest` for Sentry-style breadcrumbs.
 *
 * The cap is intentionally generous: 500 requestIds × 30 stages each
 * is 15k records — about 1MB of memory.  The store is rotated on
 * every insert past the cap.
 *
 * @author Amadou — Dicken AI
 * @version 1.0.0
 */
import { logStage } from './latence';

const MAX_REQUESTS = 500;
const MAX_STAGES_PER_REQUEST = 200;

export type StageRecord = {
  label: string;
  ms: number;
  ts: number;
  meta?: Record<string, unknown>;
};

export type RequestTimings = {
  requestId: string;
  startedAt: number;
  stages: StageRecord[];
};

// Module-level LRU-ish store.  We use insertion-ordered Map + a
// size cap.  Not thread-safe, but Node is single-threaded so we
// don't need to be.
const store: Map<string, RequestTimings> = (() => {
  const g = globalThis as unknown as { _ttfbStore?: Map<string, RequestTimings> };
  if (!g._ttfbStore) g._ttfbStore = new Map();
  return g._ttfbStore;
})();

let _currentRequestId: string | null = null;

/** Mint a fresh request id and make it "current". */
export function beginRequest(): string {
  const id = newRequestId();
  _currentRequestId = id;
  store.set(id, { requestId: id, startedAt: Date.now(), stages: [] });
  rotate();
  return id;
}

/** Stop tracking a request.  Idempotent. */
export function endRequest(id?: string): void {
  const target = id ?? _currentRequestId;
  if (!target) return;
  if (_currentRequestId === target) _currentRequestId = null;
}

/** Cheap unique-enough id.  crypto.randomUUID where available, else
 *  timestamp+random fallback. */
function newRequestId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `r-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

function rotate(): void {
  while (store.size > MAX_REQUESTS) {
    const oldest = store.keys().next().value;
    if (oldest === undefined) break;
    store.delete(oldest);
  }
}

function appendStage(requestId: string, rec: StageRecord): void {
  let entry = store.get(requestId);
  if (!entry) {
    entry = { requestId, startedAt: Date.now(), stages: [] };
    store.set(requestId, entry);
    rotate();
  }
  entry.stages.push(rec);
  if (entry.stages.length > MAX_STAGES_PER_REQUEST) {
    // Keep only the most recent N stages — we only care about the
    // tail for percentile analysis anyway.
    entry.stages.splice(0, entry.stages.length - MAX_STAGES_PER_REQUEST);
  }
}

/** Record a single stage timing.  Mirrors `logStage` (it forwards
 *  to that for the console.warn line) but also stores the record
 *  in the in-memory store.  If a requestId is provided we use it,
 *  otherwise we use the current request (set by `beginRequest`),
 *  otherwise we mint a new one. */
export function recordTiming(
  label: string,
  ms: number,
  opts: { requestId?: string; meta?: Record<string, unknown> } = {},
): void {
  logStage(label, ms, opts.meta);
  const id = opts.requestId ?? _currentRequestId ?? beginRequest();
  appendStage(id, { label, ms, ts: Date.now(), meta: opts.meta });
}

/** Return the timings for a single request, or null if unknown. */
export function getTimings(requestId: string): RequestTimings | null {
  return store.get(requestId) ?? null;
}

/** Compute percentiles for a single stage label across all stored
 *  requests.  Returns null if no samples exist. */
export function getPercentiles(
  label: string,
  percentiles: number[] = [0.5, 0.95, 0.99],
): Record<string, number> | null {
  const samples: number[] = [];
  for (const req of store.values()) {
    for (const s of req.stages) {
      if (s.label === label) samples.push(s.ms);
    }
  }
  if (samples.length === 0) return null;
  samples.sort((a, b) => a - b);
  const out: Record<string, number> = { count: samples.length };
  for (const p of percentiles) {
    const idx = Math.min(samples.length - 1, Math.floor(p * samples.length));
    out[`p${Math.round(p * 100)}`] = samples[idx]!;
  }
  return out;
}

/** Test-only: clear the store.  Never call from production code. */
export function _clearTimings(): void {
  store.clear();
  _currentRequestId = null;
}
