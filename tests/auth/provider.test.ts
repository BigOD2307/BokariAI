import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('whatsapp/provider routing', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.WHATSAPP_PROVIDER;
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  it('defaults to meta when WHATSAPP_PROVIDER is not set', async () => {
    const { getProvider } = await import('@/lib/auth/whatsapp/provider');
    expect(getProvider()).toBe('meta');
  });

  it('reads WHATSAPP_PROVIDER=kapso', async () => {
    process.env.WHATSAPP_PROVIDER = 'kapso';
    const { getProvider } = await import('@/lib/auth/whatsapp/provider');
    expect(getProvider()).toBe('kapso');
  });

  it('reads WHATSAPP_PROVIDER=dual', async () => {
    process.env.WHATSAPP_PROVIDER = 'dual';
    const { getProvider } = await import('@/lib/auth/whatsapp/provider');
    expect(getProvider()).toBe('dual');
  });

  it('falls back to meta on invalid value', async () => {
    process.env.WHATSAPP_PROVIDER = 'invalid';
    const { getProvider } = await import('@/lib/auth/whatsapp/provider');
    expect(getProvider()).toBe('meta');
  });

  it('is case-insensitive', async () => {
    process.env.WHATSAPP_PROVIDER = 'KAPSO';
    const { getProvider } = await import('@/lib/auth/whatsapp/provider');
    expect(getProvider()).toBe('kapso');
  });

  it('resetProviderCache clears the memo', async () => {
    const { getProvider, resetProviderCache } = await import(
      '@/lib/auth/whatsapp/provider'
    );
    process.env.WHATSAPP_PROVIDER = 'kapso';
    expect(getProvider()).toBe('kapso');
    delete process.env.WHATSAPP_PROVIDER;
    resetProviderCache();
    expect(getProvider()).toBe('meta');
  });
});

describe('whatsapp/provider webhook verifier', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.META_WHATSAPP_APP_SECRET = 'meta_secret';
    process.env.KAPSO_APP_SECRET = 'kapso_secret';
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  it('verifies a Meta signature in meta mode', async () => {
    process.env.WHATSAPP_PROVIDER = 'meta';
    const { verifyWebhookSignatureUnified } = await import(
      '@/lib/auth/whatsapp/provider'
    );
    const { createHmac } = await import('crypto');
    const body = '{"test":1}';
    const sig =
      'sha256=' + createHmac('sha256', 'meta_secret').update(body).digest('hex');
    expect(verifyWebhookSignatureUnified(body, sig)).toBe(true);
  });

  it('verifies a Kapso signature in kapso mode', async () => {
    process.env.WHATSAPP_PROVIDER = 'kapso';
    const { verifyWebhookSignatureUnified } = await import(
      '@/lib/auth/whatsapp/provider'
    );
    const { createHmac } = await import('crypto');
    const body = '{"test":1}';
    const sig =
      'sha256=' + createHmac('sha256', 'kapso_secret').update(body).digest('hex');
    expect(verifyWebhookSignatureUnified(body, sig)).toBe(true);
  });

  it('rejects when neither signature matches', async () => {
    process.env.WHATSAPP_PROVIDER = 'meta';
    const { verifyWebhookSignatureUnified } = await import(
      '@/lib/auth/whatsapp/provider'
    );
    expect(verifyWebhookSignatureUnified('{"test":1}', 'sha256=bogus')).toBe(false);
  });

  it('returns false when no signature is provided', async () => {
    process.env.WHATSAPP_PROVIDER = 'kapso';
    const { verifyWebhookSignatureUnified } = await import(
      '@/lib/auth/whatsapp/provider'
    );
    expect(verifyWebhookSignatureUnified('{"test":1}', null)).toBe(false);
  });
});
