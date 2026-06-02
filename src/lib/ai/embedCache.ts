/**
 * @module ai/embedCache
 * @description LRU cache for query embeddings.
 *
 * Saves a 200-400ms BGE-M3 round trip on repeat queries by caching
 * the (text, model) → vector mapping in an in-memory Map.
 *
 * The cache is bounded at 1k entries (LRU eviction).  It is
 * intentionally not persisted — embeddings are cheap to recompute
 * on cold start and disk persistence would add a synchronous IO
 * tax to the first request after a deploy.
 *
 * To disable the cache (benchmarking, A/B tests), set
 * `BOKARI_EMBED_CACHE_DISABLED=true`.
 *
 * @author Amadou — Dicken AI
 */
const EMBED_CACHE_MAX = 1000;
const EMBED_CACHE_DISABLED = process.env.BOKARI_EMBED_CACHE_DISABLED === 'true';

interface EmbedCacheNode {
  key: string;
  value: number[];
}

const embedCache = new Map<string, EmbedCacheNode>();

/** Stable, opaque cache key for an (input, model) pair.
 *  Uses a 64-bit FNV-1a hash — no Node:crypto dep, deterministic. */
export function embedCacheKey(text: string, model: string): string {
  const s = `${model}::${text}`;
  let h = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = (1n << 64n) - 1n;
  for (let i = 0; i < s.length; i++) {
    h = (h ^ BigInt(s.charCodeAt(i))) & mask;
    h = (h * prime) & mask;
  }
  return h.toString(16);
}

export function embedCacheGet(key: string): number[] | undefined {
  const node = embedCache.get(key);
  if (!node) return undefined;
  // LRU touch: move to the end.
  embedCache.delete(key);
  embedCache.set(key, node);
  return node.value;
}

export function embedCacheSet(key: string, value: number[]): void {
  if (EMBED_CACHE_DISABLED) return;
  if (embedCache.has(key)) embedCache.delete(key);
  embedCache.set(key, { key, value });
  if (embedCache.size > EMBED_CACHE_MAX) {
    const oldest = embedCache.keys().next().value;
    if (oldest !== undefined) embedCache.delete(oldest);
  }
}

export function clearEmbedCache(): void {
  embedCache.clear();
}

export function embedCacheSize(): number {
  return embedCache.size;
}
