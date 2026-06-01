/**
 * @module discover/diversity
 * @description Greedy diversity enforcement: at most N items per domain.
 * @author Amadou — Dicken AI
 * @version 1.0.0
 *
 * "Don't let one source fill 30% of the feed."
 *
 * The input is assumed to be pre-sorted by score (highest first).  We
 * walk it in order and keep an item only if its domain still has free
 * slots.  This is O(n) and stable.
 *
 * The cap is intentionally low (default 2) because we want the feed
 * to feel diverse.  If a user wants more from one source, they can
 * visit that source.
 */

const DEFAULT_MAX_PER_DOMAIN = 2;

/**
 * Apply a per-domain cap.  Items are walked in order; the first
 * `maxPerDomain` items from each domain are kept, the rest dropped.
 *
 * The input order is preserved.
 *
 * @param items         - any array of items with a `.domain` field
 * @param maxPerDomain  - maximum items to keep from any single domain (default 2)
 * @returns a new array containing only the kept items
 */
export function applyDiversityCap<T extends { domain: string }>(
  items: readonly T[],
  maxPerDomain: number = DEFAULT_MAX_PER_DOMAIN,
): T[] {
  if (!items || items.length === 0) return [];
  // NaN, negative, or non-finite (except +Infinity) → treat as no cap
  if (Number.isNaN(maxPerDomain) || maxPerDomain < 0) return [];
  const effectiveCap = Number.isFinite(maxPerDomain) ? maxPerDomain : Number.POSITIVE_INFINITY;

  const counts = new Map<string, number>();
  const out: T[] = [];

  for (const item of items) {
    const key = (item.domain || '').toLowerCase().replace(/^www\./, '');
    const current = counts.get(key) ?? 0;
    if (current >= effectiveCap) continue;
    counts.set(key, current + 1);
    out.push(item);
  }

  return out;
}
