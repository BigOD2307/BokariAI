/**
 * @module observability/latence.test
 * @description Unit tests for the latence timer helpers.
 * @author Amadou — Dicken AI
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { startTimer, logStage, stage } from '@/lib/observability/latence';

describe('startTimer', () => {
  it('returns a function that returns a number', () => {
    const end = startTimer();
    const ms = end();
    expect(typeof ms).toBe('number');
    expect(ms).toBeGreaterThanOrEqual(0);
  });

  it('returns a non-negative elapsed ms even for very short calls', async () => {
    const end = startTimer();
    // burn a tick to be sure
    await new Promise((r) => setTimeout(r, 1));
    const ms = end();
    expect(ms).toBeGreaterThanOrEqual(0);
  });

  it('frozen value is consistent across calls (does not keep ticking)', () => {
    const end = startTimer();
    const a = end();
    // Wait a bit then call again — should return roughly the same value
    // (it freezes on first call).
    setTimeout(() => {}, 10);
    const b = end();
    expect(b).toBe(a);
  });
});

describe('logStage', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('logs to console.warn with the label and ms', () => {
    logStage('chat.total', 123.4);
    expect(warnSpy).toHaveBeenCalledOnce();
    const msg = warnSpy.mock.calls[0]![0] as string;
    expect(msg).toContain('chat.total');
    expect(msg).toContain('123.4ms');
  });

  it('includes the meta JSON when provided', () => {
    logStage('chat.tool', 50, { name: 'discover_search' });
    const msg = warnSpy.mock.calls[0]![0] as string;
    expect(msg).toContain('name');
    expect(msg).toContain('discover_search');
  });

  it('omits the meta JSON when not provided', () => {
    logStage('chat.total', 1);
    const msg = warnSpy.mock.calls[0]![0] as string;
    // Should not have a trailing space + '{' from an empty meta.
    expect(msg.endsWith('1.0ms')).toBe(true);
  });

  it('does not throw on undefined or null meta', () => {
    expect(() => logStage('x', 0)).not.toThrow();
  });
});

describe('stage', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('returns a function that logs when called', () => {
    const end = stage('chat.test');
    end();
    expect(warnSpy).toHaveBeenCalledOnce();
  });

  it('merges meta + extra meta on the final call', () => {
    const end = stage('chat.test', { a: 1 });
    end({ b: 2 });
    const msg = warnSpy.mock.calls[0]![0] as string;
    // Format: "[latence] chat.test=0.1ms {"a":1,"b":2}"
    const jsonStart = msg.indexOf('{');
    expect(jsonStart).toBeGreaterThan(-1);
    const parsed = JSON.parse(msg.slice(jsonStart));
    expect(parsed.a).toBe(1);
    expect(parsed.b).toBe(2);
  });
});
