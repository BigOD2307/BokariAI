/**
 * @module social/types
 * @description Shared types for the social-search subsystem (X / Reddit /
 * LinkedIn). Mirrors the provider-router precedent in
 * `src/lib/auth/whatsapp/provider.ts` — a thin `SocialProvider` interface that
 * adapters implement and a router resolves per network.
 *
 * The provider returns the same `SearchResult` shape the rest of the search
 * pipeline already speaks (from `@/lib/search`) so callers can fold social
 * results into the existing dedup/rank/Chunk flow without a translation layer.
 */
import type { SearchResult } from '@/lib/search';

/** The social networks Bokari can search. */
export type SocialNetwork = 'x' | 'reddit' | 'linkedin';

/** Provider implementations selectable per network via env. */
export type SocialProviderKind = 'site' | 'brightdata';

/** Options forwarded to a social provider's `search`. */
export interface SocialSearchOptions {
  /** Preferred result language (BCP-47-ish, e.g. "fr"). Default "fr". */
  language?: string;
  /** Hard cap on results returned. Adapters SHOULD respect this. */
  maxResults?: number;
}

/** Uniform result envelope, identical in shape to the web search path. */
export interface SocialSearchResult {
  results: SearchResult[];
  suggestions: string[];
}

/**
 * A social provider. Implementations MUST be non-throwing: on any error
 * (missing key, network failure, bad payload) they return an empty—or
 * fallback—result set instead of rejecting, so a degraded social provider
 * never breaks a research turn.
 */
export interface SocialProvider {
  /** Which network this provider instance serves. */
  readonly network: SocialNetwork;
  /** Which underlying implementation backs it (for diagnostics/tests). */
  readonly kind: SocialProviderKind;
  search(query: string, opts?: SocialSearchOptions): Promise<SocialSearchResult>;
}
