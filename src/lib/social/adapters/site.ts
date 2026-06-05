/**
 * @module social/adapters/site
 * @description Zero-config social adapter. Injects a `site:` operator scoping
 * the query to a network's public domains and delegates to the existing
 * multi-engine scraper (`searchSearxng` from `@/lib/search`). This is the
 * default everywhere, so social search works with no keys configured.
 *
 * Never throws — `searchSearxng` already swallows engine failures and returns
 * `{ results: [], suggestions: [] }`; we add a defensive try/catch anyway so a
 * future change there can't break a research turn.
 */
import { searchSearxng, type SearchResult } from '@/lib/search';
import type {
  SocialNetwork,
  SocialProvider,
  SocialSearchOptions,
  SocialSearchResult,
} from '../types';

/**
 * The `site:` operator fragment per network. X covers both the current and
 * legacy host; LinkedIn scopes to public posts/pulse only (profiles/companies
 * are login-walled and rarely useful as snippets).
 */
const SITE_FILTERS: Record<SocialNetwork, string> = {
  x: '(site:x.com OR site:twitter.com)',
  reddit: 'site:reddit.com',
  linkedin: '(site:linkedin.com/posts OR site:linkedin.com/pulse)',
};

/** Build the site-scoped query string for a network. Exported for tests. */
export const buildSiteQuery = (network: SocialNetwork, query: string): string =>
  `${SITE_FILTERS[network]} ${query}`.trim();

/**
 * Create a site-operator-backed provider for one network.
 */
export const createSiteProvider = (network: SocialNetwork): SocialProvider => ({
  network,
  kind: 'site',
  async search(
    query: string,
    opts?: SocialSearchOptions,
  ): Promise<SocialSearchResult> {
    try {
      const res = await searchSearxng(buildSiteQuery(network, query), {
        language: opts?.language ?? 'fr',
      });
      const results: SearchResult[] = opts?.maxResults
        ? res.results.slice(0, opts.maxResults)
        : res.results;
      return { results, suggestions: res.suggestions ?? [] };
    } catch (err) {
      console.warn(`[Bokari Social] site adapter (${network}) failed:`, err);
      return { results: [], suggestions: [] };
    }
  },
});
