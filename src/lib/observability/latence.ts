/**
 * @module observability/latence
 * @description Lightweight timing helpers for `/api/chat` and any
 * other hot path.  No external dep, no global state — every timer
 * is a closure the caller is responsible for ending.
 *
 * Usage:
 *   const end = startTimer('chat.load_models');
 *   // ... work ...
 *   logStage('chat.load_models', end(), { provider: 'groq' });
 *
 * Or for nested stages:
 *   const t0 = startTimer('chat.total');
 *   const t1 = startTimer('chat.tool.discover_search');
 *   // ... tool call ...
 *   logStage('chat.tool.discover_search', t1());
 *   logStage('chat.total', t0());
 *
 * Output goes to `console.warn` (dev) and to a stub Sentry hook
 * (no-op in V1).  When we wire Sentry in Phase 12, this is the
 * single seam.
 *
 * @author Amadou — Dicken AI
 * @version 1.0.0
 */

/** Monotonic high-resolution clock that works in both the browser and
 *  Node (no `process.hrtime`, which is undefined in client bundles). */
const nowMs = (): number =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();

/** Start a high-resolution timer.  Returns a function that, when
 *  called, returns the elapsed milliseconds and freezes the value. */
export function startTimer(): () => number {
  const t0 = nowMs();
  let frozen: number | null = null;
  return () => {
    if (frozen !== null) return frozen;
    frozen = nowMs() - t0;
    return frozen;
  };
}

/** Log a stage timing.  Format: `[latence] <label>=<ms>ms <meta?>`. */
export function logStage(label: string, ms: number, meta?: Record<string, unknown>): void {
  const metaStr = meta ? ' ' + JSON.stringify(meta) : '';
  // warn (not log) so it shows up in production without a debug flag.
  // eslint-disable-next-line no-console
  console.warn(`[latence] ${label}=${ms.toFixed(1)}ms${metaStr}`);
}

/** Build a single-shot logger for a parent stage.  Lets callers
 *  record a final time without manually calling logStage twice. */
export function stage(label: string, meta?: Record<string, unknown>) {
  const end = startTimer();
  return (extra?: Record<string, unknown>) => {
    logStage(label, end(), { ...meta, ...extra });
  };
}
