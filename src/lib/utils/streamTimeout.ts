/**
 * @module utils/streamTimeout
 * @description Wrap an async iterable with hard timeouts so a
 * stalled upstream (Groq / OpenRouter / Ollama) cannot pin a
 * Bokari request forever.
 *
 *  - `withTimeout()` adds a per-chunk deadline: if no new chunk
 *    arrives within `idleMs`, the iterator rejects with a
 *    `StreamTimeoutError`.  The first chunk gets the larger
 *    `firstChunkMs` budget (cold start, model boot, prompt eval).
 *  - `withTotalTimeout()` adds a wall-clock cap: even if chunks
 *    keep dribbling in, the iterator rejects once `totalMs` has
 *    elapsed since the first `next()`.
 *
 * The wrapper never mutates the input stream.  It does *not*
 * close the upstream — we cannot from JavaScript.  It only
 * stops iterating and rejects the consumer's promise.
 *
 * @author Amadou — Dicken AI
 */

export class StreamTimeoutError extends Error {
  constructor(
    message: string,
    public stage: 'first-chunk' | 'idle' | 'total',
    public ms: number,
  ) {
    super(message);
    this.name = 'StreamTimeoutError';
  }
}

export interface StreamTimeoutOptions {
  /** Time to wait for the very first chunk.  Default 60 000 ms. */
  firstChunkMs?: number;
  /** Time to wait between subsequent chunks.  Default 30 000 ms. */
  idleMs?: number;
  /** Hard wall-clock cap from the first next() to the last.  Default 5 * 60 * 1000. */
  totalMs?: number;
  /** Optional label used in error messages. */
  label?: string;
}

const DEFAULTS: Required<Omit<StreamTimeoutOptions, 'label'>> = {
  firstChunkMs: 60_000,
  idleMs: 30_000,
  totalMs: 5 * 60_000,
};

/**
 * Wrap an async iterable with per-chunk + total timeouts.
 *
 *   const safe = withTimeout(rawStream, { firstChunkMs: 60_000, idleMs: 30_000 });
 *   for await (const c of safe) { ... }
 *
 * If the upstream is already an AsyncIterable (not an
 * AsyncIterator), pass it in directly.  If you've already
 * called `[Symbol.asyncIterator]()`, you can pass the iterator
 * instead — both are accepted.
 */
export function withTimeout<T>(
  source:
    | AsyncIterable<T>
    | AsyncIterator<T>
    | { [Symbol.asyncIterator](): AsyncIterator<T> },
  opts: StreamTimeoutOptions = {},
): AsyncIterable<T> {
  const cfg = { ...DEFAULTS, ...opts };
  const label = opts.label ?? 'stream';
  const iter: AsyncIterator<T> =
    typeof (source as any).next === 'function'
      ? (source as AsyncIterator<T>)
      : (source as AsyncIterable<T>)[Symbol.asyncIterator]();

  const startedAt = Date.now();
  let chunksSeen = 0;
  let totalTimer: ReturnType<typeof setTimeout> | null = null;

  function clearTotalTimer() {
    if (totalTimer) {
      clearTimeout(totalTimer);
      totalTimer = null;
    }
  }

  return {
    [Symbol.asyncIterator]() {
      return this;
    },
    async next(): Promise<IteratorResult<T>> {
      if (chunksSeen === 0) {
        // First chunk: stricter timeout.
        const result = await raceWithTimeout(iter.next(), cfg.firstChunkMs, {
          stage: 'first-chunk',
          ms: cfg.firstChunkMs,
          label,
        });
        if (result.done) {
          clearTotalTimer();
          return result;
        }
        chunksSeen = 1;
        const remaining = cfg.totalMs - (Date.now() - startedAt);
        if (remaining <= 0) {
          throw new StreamTimeoutError(
            `[${label}] total timeout ${cfg.totalMs}ms exceeded before any chunk`,
            'total',
            cfg.totalMs,
          );
        }
        totalTimer = setTimeout(() => {
          // We can't reject from here directly.  We rely on the next
          // .next() to see that the deadline passed.
        }, remaining);
        return result;
      }

      // Subsequent chunks: per-idle + remaining-total.
      const remaining = cfg.totalMs - (Date.now() - startedAt);
      if (remaining <= 0) {
        clearTotalTimer();
        throw new StreamTimeoutError(
          `[${label}] total timeout ${cfg.totalMs}ms exceeded`,
          'total',
          cfg.totalMs,
        );
      }
      const perChunk = Math.min(cfg.idleMs, remaining);
      // If we're constrained by the total budget, label this as
      // a 'total' timeout, not 'idle' — the symptom is the same
      // but the user-facing message should make it clear the
      // whole request is over budget.
      const stage: 'idle' | 'total' = perChunk === remaining ? 'total' : 'idle';
      const result = await raceWithTimeout(iter.next(), perChunk, {
        stage,
        ms: perChunk,
        label,
      });
      if (result.done) {
        clearTotalTimer();
        return result;
      }
      chunksSeen += 1;
      return result;
    },
    async return(value?: any): Promise<IteratorResult<T>> {
      clearTotalTimer();
      if (typeof iter.return === 'function') {
        return iter.return(value);
      }
      return { value, done: true } as IteratorResult<T>;
    },
    async throw(err?: any): Promise<IteratorResult<T>> {
      clearTotalTimer();
      if (typeof iter.throw === 'function') {
        return iter.throw(err);
      }
      throw err;
    },
  };
}

async function raceWithTimeout<T>(
  p: Promise<IteratorResult<T>>,
  ms: number,
  meta: { stage: 'first-chunk' | 'idle' | 'total'; ms: number; label: string },
): Promise<IteratorResult<T>> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await new Promise<IteratorResult<T>>((resolve, reject) => {
      timer = setTimeout(() => {
        reject(
          new StreamTimeoutError(
            `[${meta.label}] ${meta.stage} timeout after ${ms}ms`,
            meta.stage,
            ms,
          ),
        );
      }, ms);
      p.then(
        (v) => {
          if (timer) clearTimeout(timer);
          resolve(v);
        },
        (e) => {
          if (timer) clearTimeout(timer);
          reject(e);
        },
      );
    });
  } finally {
    if (timer) clearTimeout(timer);
  }
}
