/**
 * @module types/feedback
 * @description Shared types for the Phase 8 feedback loop
 * (thumbs up/down + optional comment + captured context).
 *
 * The feedback component in the UI builds a `CapturedContext` from the
 * `Section` / `Message` it has on hand, then POSTs a `FeedbackPayload`
 * to `/api/feedback`.  The API route validates the payload with zod and
 * writes a single row to `public.feedback`.
 *
 * Captured fields are the union of:
 *   - **what the user saw** (query, response, sources, citation count)
 *   - **how Bokari produced it** (chat/embedding model, optimization mode,
 *     research step count, has Bokari-discover citations, latency)
 *   - **client metadata** (locale, user agent)
 *
 * This row is *self-contained* — the export script
 * (`scripts/export-feedback.ts`) can dump it straight to a fine-tuning
 * JSONL without joining other tables.
 *
 * @author Amadou — Dicken AI
 * @version 1.0.0
 */

/** What the user clicked.  -1 = 👎, 0 = cleared, 1 = 👍. */
export type FeedbackRating = -1 | 0 | 1;

/**
 * A single source Bokari cited in the response.
 * Mirrors the shape we render in `MessageSources` (url, title, favicon domain).
 */
export type FeedbackSource = {
  url: string;
  title: string;
  domain?: string;
  /** 'bokari-discover' = the citation engine, anything else = web.  Phase 4. */
  source?: string;
};

/**
 * How Bokari produced this response.  Everything we can read client-side.
 */
export type FeedbackMetadata = {
  /** Chat provider type from useChat().chatModelProvider.providerId. */
  chatProvider: string;
  /** Chat model key from useChat().chatModelProvider.key. */
  chatModel: string;
  /** Embedding provider type. */
  embeddingProvider: string;
  /** Embedding model key. */
  embeddingModel: string;
  /** 'speed' | 'balanced' | 'quality' from the optimization mode selector. */
  optimizationMode: string;
  /** Number of sub-steps in the research block.  0 if Bokari skipped research. */
  researchStepCount: number;
  /** Total number of sources cited (deduplicated by URL). */
  sourceCount: number;
  /** How many of the cited sources came from the Bokari-discover citation engine. */
  bokariCitationCount: number;
  /** True if at least one Bokari-discover source was cited. */
  hasBokariCitations: boolean;
  /** How long the response took, in milliseconds.  messageEnd - createdAt. */
  latencyMs: number | null;
  /** Browser language.  e.g. "fr-FR". */
  locale: string;
  /** Truncated to 256 chars to keep the row small. */
  userAgent: string;
};

/**
 * What the user saw: the full conversation snapshot.
 */
export type CapturedContext = {
  query: string;
  /**
   * The final response text, already cleaned of <think> tags and citation
   * wrappers.  This is what the user actually read.
   */
  response: string;
  /** All sources cited in the response. */
  sources: FeedbackSource[];
  metadata: FeedbackMetadata;
};

/**
 * Body the client POSTs to /api/feedback.
 *
 *   POST /api/feedback
 *   {
 *     "messageId": "abc123",
 *     "chatId": "xyz789",
 *     "rating": 1,
 *     "comment": null,        // optional
 *     "captured": { ... }
 *   }
 */
export type FeedbackPayload = {
  messageId: string;
  chatId?: string | null;
  rating: FeedbackRating;
  comment?: string | null;
  captured: CapturedContext;
};
