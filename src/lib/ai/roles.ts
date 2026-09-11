/**
 * One model route per role, resolved server-side. The browser no longer picks
 * a model: it was choosing gpt-4o through the `bokari-1` alias on every single
 * request, which is both the most expensive option and the one that took the
 * whole product down when the account hit its rate limit.
 */
import type { GenerateOptions } from '@/lib/models/types';

export type LlmRole =
  | 'classifier' // structured JSON, must be deterministic
  | 'researcher' // tool planning, must be deterministic
  | 'writer' // prose, mild creativity
  | 'extractor' // charts, verdicts, flashcards: strict JSON
  | 'title'
  | 'blog'
  | 'stats';

/** Sampling per role. Anything that produces JSON or a plan runs at 0. */
export const ROLE_OPTIONS: Record<LlmRole, GenerateOptions> = {
  classifier: { temperature: 0, label: 'classifier' },
  researcher: { temperature: 0, label: 'researcher' },
  writer: { temperature: 0.4, label: 'writer' },
  extractor: { temperature: 0.1, label: 'extractor' },
  title: { temperature: 0.2, maxTokens: 32, label: 'title' },
  blog: { temperature: 0.3, maxTokens: 5000, label: 'blog' },
  stats: { temperature: 0, maxTokens: 160, label: 'stats' },
};

/** Roles cheap enough to run on the fast tier when one is configured. */
export const FAST_TIER_ROLES: ReadonlySet<LlmRole> = new Set([
  'classifier',
  'title',
  'stats',
]);
