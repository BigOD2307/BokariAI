/**
 * @module youtube/types
 * @description Shared types for the YouTube subsystem (search + comprehension).
 *
 * The search side returns the same `SearchResult` shape the rest of the search
 * pipeline already speaks (from `@/lib/search`) so callers can fold YouTube
 * results into the existing dedup/rank/Chunk flow without a translation layer.
 *
 * The comprehension side returns a `TranscriptResult` — a list of timed
 * segments plus provenance — or a typed unavailable marker so callers can
 * degrade gracefully instead of branching on thrown errors.
 */
import type { SearchResult } from '@/lib/search';

/** Search provider implementations, env-selected. */
export type YouTubeProviderKind = 'scrape' | 'api' | 'brightdata';

/** Options forwarded to a YouTube search provider's `search`. */
export interface YouTubeSearchOptions {
  /** Preferred result language (BCP-47-ish, e.g. "fr"). Default "fr". */
  language?: string;
  /** Hard cap on results returned. Adapters SHOULD respect this. */
  maxResults?: number;
}

/** Uniform result envelope, identical in shape to the web search path. */
export interface YouTubeSearchResult {
  results: SearchResult[];
  suggestions: string[];
}

/**
 * A YouTube search provider. Implementations MUST be non-throwing: on any
 * error (missing key, quota, network failure, bad payload) they return an
 * empty—or fallback—result set instead of rejecting, so a degraded provider
 * never breaks a research turn.
 */
export interface YouTubeProvider {
  /** Which underlying implementation backs it (for diagnostics/tests). */
  readonly kind: YouTubeProviderKind;
  search(
    query: string,
    opts?: YouTubeSearchOptions,
  ): Promise<YouTubeSearchResult>;
}

/** One timed transcript segment. Times are seconds from the video start. */
export interface TranscriptSegment {
  text: string;
  /** Start offset in seconds. */
  start: number;
  /** Segment duration in seconds (best-effort; may be 0 if unknown). */
  duration: number;
}

/** Where a transcript came from, in graded first-success order. */
export type TranscriptSource =
  | 'brightdata'
  | 'innertube'
  | 'managed'
  | 'elevenlabs'
  | 'unavailable';

/**
 * Result of a transcript fetch. `segments` is empty and `source` is
 * `'unavailable'` when no provider could produce a transcript — callers check
 * `source === 'unavailable'` rather than catching.
 */
export interface TranscriptResult {
  videoId: string;
  segments: TranscriptSegment[];
  /** Detected/declared language of the transcript (BCP-47-ish). */
  lang: string;
  source: TranscriptSource;
}
