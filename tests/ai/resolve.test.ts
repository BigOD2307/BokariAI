import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { fastTierStatus } from '@/lib/ai/resolve';

const VARS = [
  'BOKARI_FAST_CHAT_PROVIDER',
  'BOKARI_FAST_CHAT_MODEL',
  'BOKARI_FAST_CHAT_PROVIDER_ID',
  'BOKARI_FAST_CHAT_KEY',
] as const;

let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = {};
  for (const v of VARS) {
    saved[v] = process.env[v];
    delete process.env[v];
  }
});

afterEach(() => {
  for (const v of VARS) {
    if (saved[v] === undefined) delete process.env[v];
    else process.env[v] = saved[v];
  }
});

describe('fastTierStatus', () => {
  it('reports unconfigured when nothing is set', () => {
    const s = fastTierStatus();
    expect(s.configured).toBe(false);
  });

  it('prefers the portable type+model form', () => {
    process.env.BOKARI_FAST_CHAT_PROVIDER = 'groq';
    process.env.BOKARI_FAST_CHAT_MODEL = 'llama-3.1-8b-instant';
    // Legacy vars present too — the type form wins.
    process.env.BOKARI_FAST_CHAT_PROVIDER_ID = 'some-uuid';
    process.env.BOKARI_FAST_CHAT_KEY = 'other-model';
    const s = fastTierStatus();
    expect(s).toEqual({
      configured: true,
      provider: 'groq',
      model: 'llama-3.1-8b-instant',
    });
  });

  it('falls back to the legacy UUID form', () => {
    process.env.BOKARI_FAST_CHAT_PROVIDER_ID = 'some-uuid';
    process.env.BOKARI_FAST_CHAT_KEY = 'llama-3.1-8b-instant';
    const s = fastTierStatus();
    expect(s.configured).toBe(true);
    if (s.configured) {
      expect(s.model).toBe('llama-3.1-8b-instant');
    }
  });

  it('ignores a half-set type form (needs both vars)', () => {
    process.env.BOKARI_FAST_CHAT_PROVIDER = 'groq';
    const s = fastTierStatus();
    expect(s.configured).toBe(false);
  });
});
