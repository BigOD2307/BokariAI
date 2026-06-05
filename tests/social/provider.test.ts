/**
 * @module tests/social/provider
 * @description Unit tests for the social provider router. Verifies the
 * default (site everywhere), per-network env selection, Bright Data degrade,
 * the master switch, and the reset hook — mirroring the WhatsApp provider
 * test contract.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('social/provider routing', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.X_SEARCH_PROVIDER;
    delete process.env.REDDIT_SEARCH_PROVIDER;
    delete process.env.LINKEDIN_SEARCH_PROVIDER;
    delete process.env.BOKARI_SOCIAL_SEARCH_ENABLED;
    delete process.env.BRIGHTDATA_API_KEY;
    delete process.env.BRIGHTDATA_DS_X_POSTS;
    delete process.env.BRIGHTDATA_DS_REDDIT_POSTS;
    delete process.env.BRIGHTDATA_DS_LINKEDIN_POSTS;
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  it('defaults every network to the site provider', async () => {
    const { getSocialProvider, resetSocialProviderCache } = await import(
      '@/lib/social/provider'
    );
    resetSocialProviderCache();
    expect(getSocialProvider('x').kind).toBe('site');
    expect(getSocialProvider('reddit').kind).toBe('site');
    expect(getSocialProvider('linkedin').kind).toBe('site');
  });

  it('selects brightdata when configured for that network', async () => {
    process.env.X_SEARCH_PROVIDER = 'brightdata';
    process.env.BRIGHTDATA_API_KEY = 'bd_test';
    process.env.BRIGHTDATA_DS_X_POSTS = 'gd_x';
    const { getSocialProvider, resetSocialProviderCache } = await import(
      '@/lib/social/provider'
    );
    resetSocialProviderCache();
    expect(getSocialProvider('x').kind).toBe('brightdata');
    // Reddit not configured for brightdata → still site.
    expect(getSocialProvider('reddit').kind).toBe('site');
  });

  it('degrades brightdata to site when key/dataset missing', async () => {
    process.env.REDDIT_SEARCH_PROVIDER = 'brightdata';
    // No BRIGHTDATA_API_KEY / dataset id set.
    const { getSocialProvider, resetSocialProviderCache } = await import(
      '@/lib/social/provider'
    );
    resetSocialProviderCache();
    expect(getSocialProvider('reddit').kind).toBe('site');
  });

  it('master switch off forces site even when brightdata configured', async () => {
    process.env.BOKARI_SOCIAL_SEARCH_ENABLED = 'false';
    process.env.X_SEARCH_PROVIDER = 'brightdata';
    process.env.BRIGHTDATA_API_KEY = 'bd_test';
    process.env.BRIGHTDATA_DS_X_POSTS = 'gd_x';
    const { getSocialProvider, isSocialSearchEnabled, resetSocialProviderCache } =
      await import('@/lib/social/provider');
    resetSocialProviderCache();
    expect(isSocialSearchEnabled()).toBe(false);
    expect(getSocialProvider('x').kind).toBe('site');
  });

  it('memoizes per network and resetSocialProviderCache clears it', async () => {
    const { getSocialProvider, resetSocialProviderCache } = await import(
      '@/lib/social/provider'
    );
    resetSocialProviderCache();
    const first = getSocialProvider('x');
    const second = getSocialProvider('x');
    expect(first).toBe(second); // memoized

    process.env.X_SEARCH_PROVIDER = 'brightdata';
    process.env.BRIGHTDATA_API_KEY = 'bd_test';
    process.env.BRIGHTDATA_DS_X_POSTS = 'gd_x';
    // Without reset, still the cached site provider.
    expect(getSocialProvider('x').kind).toBe('site');
    resetSocialProviderCache();
    expect(getSocialProvider('x').kind).toBe('brightdata');
  });
});
