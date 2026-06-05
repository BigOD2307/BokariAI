/**
 * @module social/provider
 * @description Per-network provider router for social search, mirroring
 * `src/lib/auth/whatsapp/provider.ts` (env-selected, cached at module scope,
 * resettable for tests, safe default).
 *
 * Selection:
 *   - master switch `BOKARI_SOCIAL_SEARCH_ENABLED` (default true). When false,
 *     callers still get a `site` provider so zero-config keeps working — the
 *     flag exists to let ops force the cheap path, not to break search.
 *   - per-network `X_SEARCH_PROVIDER` / `REDDIT_SEARCH_PROVIDER` /
 *     `LINKEDIN_SEARCH_PROVIDER` ∈ { "site", "brightdata" }, default "site".
 *   - "brightdata" silently degrades to "site" when no key/dataset is set, so
 *     a misconfigured env never throws.
 */
import type { SocialNetwork, SocialProvider, SocialProviderKind } from './types';
import { createSiteProvider } from './adapters/site';
import {
  createBrightDataProvider,
  isBrightDataConfigured,
} from './adapters/brightdata';

const PROVIDER_ENV: Record<SocialNetwork, string> = {
  x: 'X_SEARCH_PROVIDER',
  reddit: 'REDDIT_SEARCH_PROVIDER',
  linkedin: 'LINKEDIN_SEARCH_PROVIDER',
};

const cache = new Map<SocialNetwork, SocialProvider>();

/** Whether social search is enabled at all. Default true → zero-config on. */
export const isSocialSearchEnabled = (): boolean =>
  (process.env.BOKARI_SOCIAL_SEARCH_ENABLED ?? 'true').toLowerCase() !== 'false';

/** Resolve the configured provider kind for a network (pre-fallback). */
const resolveKind = (network: SocialNetwork): SocialProviderKind => {
  if (!isSocialSearchEnabled()) return 'site';
  const raw = (process.env[PROVIDER_ENV[network]] ?? 'site').toLowerCase();
  if (raw === 'brightdata') {
    // Degrade to site unless Bright Data is actually configured.
    return isBrightDataConfigured(network) ? 'brightdata' : 'site';
  }
  return 'site';
};

const build = (network: SocialNetwork): SocialProvider => {
  const kind = resolveKind(network);
  return kind === 'brightdata'
    ? createBrightDataProvider(network)
    : createSiteProvider(network);
};

/** Get (memoized) the provider for a network. */
export const getSocialProvider = (network: SocialNetwork): SocialProvider => {
  const cached = cache.get(network);
  if (cached) return cached;
  const provider = build(network);
  cache.set(network, provider);
  return provider;
};

/** Test/ops hook: drop the memo so env changes take effect. */
export const resetSocialProviderCache = (): void => {
  cache.clear();
};

/** All networks Bokari knows how to search. */
export const SOCIAL_NETWORKS: SocialNetwork[] = ['x', 'reddit', 'linkedin'];
