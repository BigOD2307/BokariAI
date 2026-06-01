/**
 * @module discover/freshness
 * @description Time-decay scoring for Discover articles.
 * @author Amadou — Dicken AI
 * @version 1.0.0
 *
 * "Today's news beats yesterday's news" — but with diminishing returns.
 * We use an exponential decay with a configurable half-life, floored
 * at 5% so a 2-month-old article isn't dead, just de-prioritized.
 *
 *   score(age) = max(floor, 0.5 ^ (age / halfLife))
 *
 * The floor matters for evergreen content.  An old article about
 * "how BRVM works" is still useful — we just don't want it to dominate
 * a Discover feed of "what's happening in Africa right now".
 */

const DEFAULT_HALF_LIFE_MS = 3 * 24 * 60 * 60 * 1000; // 3 days
const DEFAULT_FLOOR = 0.05;

/**
 * Compute a freshness score in [floor, 1].
 *
 * @param ageMs      - milliseconds since the article was published (>= 0 expected)
 * @param halfLifeMs - time for score to halve. Default: 3 days.
 * @param floor      - minimum score. Default: 0.05.
 * @returns 1.0 for brand-new, decaying exponentially, never below floor.
 */
export function freshnessScore(
  ageMs: number,
  halfLifeMs: number = DEFAULT_HALF_LIFE_MS,
  floor: number = DEFAULT_FLOOR,
): number {
  if (!Number.isFinite(ageMs) || ageMs <= 0) return 1;
  if (halfLifeMs <= 0) return 1; // half-life of 0 means "always fresh"
  if (floor < 0) floor = 0;
  if (floor > 1) return 1; // nonsensical floor

  const raw = Math.pow(0.5, ageMs / halfLifeMs);
  return Math.max(floor, Math.min(1, raw));
}

/**
 * Helper: compute the age in ms between two Dates, clamped to >= 0.
 */
export function ageMs(publishedAt: Date | null, now: Date): number {
  if (!publishedAt) return Number.POSITIVE_INFINITY; // missing = oldest
  const diff = now.getTime() - publishedAt.getTime();
  return diff > 0 ? diff : 0;
}
