import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateOtpCode,
  hashOtp,
  OtpError,
} from '@/lib/auth/whatsapp/otp-store';
import {
  META_GRAPH_API_VERSION,
  WhatsAppConfigError,
  verifyWebhookSignature,
} from '@/lib/auth/whatsapp/meta-client';
import { checkRate, resetRate, _resetAllForTests } from '@/lib/auth/rate-limit';

describe('otp-store/generateOtpCode', () => {
  it('returns a 6-digit string', () => {
    for (let i = 0; i < 20; i += 1) {
      const code = generateOtpCode();
      expect(code).toMatch(/^\d{6}$/);
      const n = parseInt(code, 10);
      expect(n).toBeGreaterThanOrEqual(100000);
      expect(n).toBeLessThan(1000000);
    }
  });
});

describe('otp-store/hashOtp', () => {
  it('produces a bcrypt hash, not the plain code', async () => {
    const hash = await hashOtp('123456');
    expect(hash).not.toBe('123456');
    expect(hash.length).toBeGreaterThan(20);
    expect(hash.startsWith('$2')).toBe(true);
  });

  it('produces a different hash for the same input (salted)', async () => {
    const a = await hashOtp('123456');
    const b = await hashOtp('123456');
    expect(a).not.toBe(b);
  });
});

describe('meta-client/verifyWebhookSignature', () => {
  const appSecret = 'test-app-secret-12345';
  const rawBody = '{"entry":[]}';

  it('accepts a correctly signed payload', () => {
    const { createHmac } = require('crypto') as typeof import('crypto');
    const sig = 'sha256=' + createHmac('sha256', appSecret).update(rawBody).digest('hex');
    expect(verifyWebhookSignature(rawBody, sig, appSecret)).toBe(true);
  });

  it('rejects an invalid signature', () => {
    expect(verifyWebhookSignature(rawBody, 'sha256=invalid', appSecret)).toBe(false);
  });

  it('rejects missing signature header', () => {
    expect(verifyWebhookSignature(rawBody, null, appSecret)).toBe(false);
  });

  it('rejects missing app secret', () => {
    expect(verifyWebhookSignature(rawBody, 'sha256=abc', null)).toBe(false);
  });

  it('rejects when prefix is wrong', () => {
    const { createHmac } = require('crypto') as typeof import('crypto');
    const sig = createHmac('sha256', appSecret).update(rawBody).digest('hex');
    expect(verifyWebhookSignature(rawBody, sig, appSecret)).toBe(false);
  });
});

describe('rate-limit/checkRate', () => {
  beforeEach(() => _resetAllForTests());

  it('allows up to max requests, then denies', () => {
    const key = 'test:user:1';
    const max = 3;
    const window = 60;
    expect(checkRate(key, max, window).allowed).toBe(true);
    expect(checkRate(key, max, window).allowed).toBe(true);
    expect(checkRate(key, max, window).allowed).toBe(true);
    const denied = checkRate(key, max, window);
    expect(denied.allowed).toBe(false);
    expect(denied.remaining).toBe(0);
  });

  it('reports remaining count correctly', () => {
    const key = 'test:user:2';
    const r1 = checkRate(key, 5, 60);
    expect(r1.remaining).toBe(4);
    const r2 = checkRate(key, 5, 60);
    expect(r2.remaining).toBe(3);
  });

  it('resets after the window expires', async () => {
    const key = 'test:user:3';
    checkRate(key, 1, 1);
    expect(checkRate(key, 1, 1).allowed).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 1100));
    expect(checkRate(key, 1, 1).allowed).toBe(true);
  });

  it('resetRate clears the bucket', () => {
    const key = 'test:user:4';
    checkRate(key, 1, 60);
    expect(checkRate(key, 1, 60).allowed).toBe(false);
    resetRate(key);
    expect(checkRate(key, 1, 60).allowed).toBe(true);
  });

  it('evicts expired buckets on sweep', async () => {
    const key = 'test:user:5';
    checkRate(key, 1, 1);
    await new Promise((resolve) => setTimeout(resolve, 1100));
    checkRate(key, 5, 60);
    expect(checkRate(key, 5, 60).remaining).toBe(3);
  });
});

describe('meta-client/constants', () => {
  it('uses the expected Graph API version', () => {
    expect(META_GRAPH_API_VERSION).toBe('v20.0');
  });
});

describe('OtpError class', () => {
  it('exposes a typed code', () => {
    const err = new OtpError('Test', 'INVALID');
    expect(err.name).toBe('OtpError');
    expect(err.code).toBe('INVALID');
    expect(err.message).toBe('Test');
  });
});

describe('WhatsAppConfigError class', () => {
  it('has the right name', () => {
    const err = new WhatsAppConfigError('missing token');
    expect(err.name).toBe('WhatsAppConfigError');
  });
});
