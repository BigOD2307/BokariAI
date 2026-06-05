import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('kapso-client/verifyKapsoWebhookSignature', () => {
  const appSecret = 'test-app-secret-12345';
  const rawBody = '{"entry":[]}';
  const originalCreateHmac = vi.fn();

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const loadFresh = async () => {
    const mod = await import('@/lib/auth/whatsapp/kapso-client');
    return mod.verifyKapsoWebhookSignature;
  };

  it('accepts a correctly signed payload', async () => {
    const { createHmac } = await import('crypto');
    const sig = 'sha256=' + createHmac('sha256', appSecret).update(rawBody).digest('hex');
    const verify = await loadFresh();
    expect(verify(rawBody, sig, appSecret)).toBe(true);
  });

  it('rejects an invalid signature', async () => {
    const verify = await loadFresh();
    expect(verify(rawBody, 'sha256=invalid', appSecret)).toBe(false);
  });

  it('rejects missing signature', async () => {
    const verify = await loadFresh();
    expect(verify(rawBody, null, appSecret)).toBe(false);
  });

  it('rejects missing app secret', async () => {
    const verify = await loadFresh();
    expect(verify(rawBody, 'sha256=abc', null)).toBe(false);
  });

  it('rejects an entirely invalid signature', async () => {
    const verify = await loadFresh();
    expect(verify(rawBody, 'sha256=deadbeef', appSecret)).toBe(false);
  });

  it('accepts signature with or without sha256= prefix', async () => {
    const { createHmac } = await import('crypto');
    const hex = createHmac('sha256', appSecret).update(rawBody).digest('hex');
    const verify = await loadFresh();
    expect(verify(rawBody, hex, appSecret)).toBe(true);
    expect(verify(rawBody, `sha256=${hex}`, appSecret)).toBe(true);
  });
});

describe('kapso-client/kapsoHealth', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.KAPSO_API_KEY;
    delete process.env.KAPSO_PHONE_NUMBER_ID;
    delete process.env.META_WHATSAPP_PHONE_ID;
    delete process.env.KAPSO_APP_SECRET;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  it('reports unconfigured when no env vars are set', async () => {
    const { kapsoHealth } = await import('@/lib/auth/whatsapp/kapso-client');
    const h = kapsoHealth();
    expect(h.configured).toBe(false);
    expect(h.apiKeySet).toBe(false);
    expect(h.phoneNumberId).toBeNull();
    expect(h.appSecretSet).toBe(false);
  });

  it('reports fully configured when all env vars are set', async () => {
    process.env.KAPSO_API_KEY = 'kapso_test';
    process.env.KAPSO_PHONE_NUMBER_ID = '1234567890';
    process.env.KAPSO_APP_SECRET = 'app_secret';
    const { kapsoHealth } = await import('@/lib/auth/whatsapp/kapso-client');
    const h = kapsoHealth();
    expect(h.configured).toBe(true);
    expect(h.apiKeySet).toBe(true);
    expect(h.phoneNumberId).toBe('1234567890');
    expect(h.appSecretSet).toBe(true);
  });

  it('falls back to META_WHATSAPP_PHONE_ID if KAPSO_PHONE_NUMBER_ID is missing', async () => {
    process.env.KAPSO_API_KEY = 'kapso_test';
    process.env.META_WHATSAPP_PHONE_ID = '9999999999';
    const { kapsoHealth } = await import('@/lib/auth/whatsapp/kapso-client');
    const h = kapsoHealth();
    expect(h.configured).toBe(true);
    expect(h.phoneNumberId).toBe('9999999999');
  });
});

describe('kapso-client/resetKapsoClientCache', () => {
  it('is callable', async () => {
    const { resetKapsoClientCache } = await import('@/lib/auth/whatsapp/kapso-client');
    expect(typeof resetKapsoClientCache).toBe('function');
    expect(() => resetKapsoClientCache()).not.toThrow();
  });
});
