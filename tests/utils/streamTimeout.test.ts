import { describe, it, expect } from 'vitest';
import {
  StreamTimeoutError,
  withTimeout,
} from '@/lib/utils/streamTimeout';

async function* fromArray<T>(items: T[], delayMs = 0): AsyncGenerator<T> {
  for (const item of items) {
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
    yield item;
  }
}

async function* hang(): AsyncGenerator<number> {
  // Never yields.  Hangs forever.
  await new Promise(() => {});
  yield 42; // unreachable
}

describe('withTimeout — happy path', () => {
  it('passes every chunk through unchanged', async () => {
    const out: number[] = [];
    for await (const c of withTimeout(fromArray([1, 2, 3]), {
      firstChunkMs: 50,
      idleMs: 50,
    })) {
      out.push(c);
    }
    expect(out).toEqual([1, 2, 3]);
  });

  it('does not require a total timeout when chunks are fast', async () => {
    const it = withTimeout(fromArray(['a', 'b']), {
      firstChunkMs: 50,
      idleMs: 50,
      totalMs: 1000,
    });
    for await (const c of it) {
      expect(typeof c).toBe('string');
    }
  });
});

describe('withTimeout — failure modes', () => {
  it('throws StreamTimeoutError when the first chunk is late', async () => {
    const slow: AsyncGenerator<number> = (async function* () {
      await new Promise((r) => setTimeout(r, 200));
      yield 1;
    })();
    await expect(async () => {
      for await (const _ of withTimeout(slow, { firstChunkMs: 30 })) {
        // never reached
      }
    }).rejects.toThrowError(StreamTimeoutError);
  });

  it('error has the right stage and ms', async () => {
    const slow: AsyncGenerator<number> = (async function* () {
      await new Promise((r) => setTimeout(r, 200));
      yield 1;
    })();
    try {
      for await (const _ of withTimeout(slow, {
        firstChunkMs: 30,
        label: 'test-stream',
      })) {
        // never reached
      }
      throw new Error('expected to throw');
    } catch (e) {
      expect(e).toBeInstanceOf(StreamTimeoutError);
      const err = e as StreamTimeoutError;
      expect(err.stage).toBe('first-chunk');
      expect(err.ms).toBe(30);
      expect(err.message).toMatch(/test-stream/);
    }
  });

  it('throws on per-chunk idle timeout', async () => {
    const it = withTimeout(
      (async function* () {
        yield 1;
        await new Promise((r) => setTimeout(r, 200));
        yield 2;
      })(),
      { firstChunkMs: 50, idleMs: 30 },
    );
    const out: number[] = [];
    await expect(async () => {
      for await (const c of it) out.push(c);
    }).rejects.toThrowError(StreamTimeoutError);
    expect(out).toEqual([1]);
  });

  it('throws on total timeout even if chunks dribble in', async () => {
    const it = withTimeout(
      (async function* () {
        yield 1;
        await new Promise((r) => setTimeout(r, 20));
        yield 2;
        await new Promise((r) => setTimeout(r, 20));
        yield 3;
        // never ends, total timeout will fire first
      })(),
      { firstChunkMs: 50, idleMs: 1000, totalMs: 40 },
    );
    await expect(async () => {
      for await (const _ of it) {
        // drain
      }
    }).rejects.toThrowError(/total/i);
  });

  it('total-timeout error mentions the total stage', async () => {
    const it = withTimeout(
      (async function* () {
        yield 1;
        await new Promise((r) => setTimeout(r, 20));
        yield 2;
        await new Promise((r) => setTimeout(r, 20));
        yield 3;
      })(),
      { firstChunkMs: 50, idleMs: 1000, totalMs: 40 },
    );
    try {
      for await (const _ of it) {
        // drain
      }
      throw new Error('expected to throw');
    } catch (e) {
      expect((e as StreamTimeoutError).stage).toBe('total');
    }
  });

  it('handles a stream that hangs on the first chunk', async () => {
    const it = withTimeout(hang(), { firstChunkMs: 30 });
    await expect(async () => {
      for await (const _ of it) {
        // never reached
      }
    }).rejects.toThrowError(/first-chunk/);
  });
});
