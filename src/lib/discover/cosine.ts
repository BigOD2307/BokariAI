/**
 * @module discover/cosine
 * @description Pure cosine similarity for the Discover pipeline.
 *
 * No external deps, no allocations beyond the loops.  We use this at
 * query time to score candidate articles against an embedded query,
 * and at refresh time to verify embeddings have the right shape.
 *
 * @author Amadou — Dicken AI
 * @version 1.0.0
 */

/**
 * Cosine similarity in [-1, 1].  Returns 0 for any edge case (zero
 * vector, mismatched length, non-finite inputs) — the ranker treats
 * "no signal" as 0 and falls back to BM25 alone.
 */
export function cosine(a: number[], b: number[]): number {
  if (!a || !b || a.length === 0 || b.length !== a.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (!Number.isFinite(x) || !Number.isFinite(y)) return 0;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/**
 * Map cosine similarity from [-1, 1] to [0, 1].  The Discover ranker
 * uses this so it can blend the score as a multiplier in [0.7, 1.0].
 */
export function cosine01(sim: number): number {
  if (!Number.isFinite(sim)) return 0;
  if (sim <= -1) return 0;
  if (sim >= 1) return 1;
  return (sim + 1) / 2;
}
