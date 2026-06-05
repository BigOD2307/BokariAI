/**
 * @module cache/semantic
 * @description High-level semantic cache helpers used by /api/chat.
 *
 * Layers on top of `store.ts`:
 *   - `normaliseQuery` — fold case, trim, strip punctuation, drop
 *     common filler words.  Two queries that *normalise* to the same
 *     string are almost certainly the same intent.
 *   - `hashQuery` — fast, deterministic 64-bit FNV-1a hash.  Same
 *     algorithm as `embedCacheKey` so we share a key style.
 *   - `tryGetCachedResponse` — first try an exact-hash hit, then
 *     fall back to a cosine-similarity scan above `COSINE_THRESHOLD`.
 *   - `cacheResponse` — store the response and its embedding.
 *   - `getCacheStats` — read-only peek at cache health.
 *
 * The embedding function is injected by the caller so this module
 * stays pure and testable.  In production we pass `embedOne` from
 * `@/lib/ai/gateway`.
 *
 * @author Amadou — Dicken AI
 * @version 1.0.0
 */
import { SemanticCache, cosineSimilarity } from './store';

/**
 * Cosine similarity above this number is treated as the same intent.
 * Env-tunable via `BOKARI_CACHE_COSINE_THRESHOLD`.  Default 0.90 — slightly
 * more recall than the old 0.92 (so French/African paraphrases collide) while
 * staying precision-favouring enough to avoid serving a wrong cached answer.
 */
export const COSINE_THRESHOLD = (() => {
  const raw = Number(process.env.BOKARI_CACHE_COSINE_THRESHOLD);
  return Number.isFinite(raw) && raw > 0 && raw <= 1 ? raw : 0.9;
})();

/** Default TTL: 7 days, in ms.  Long enough to cover the typical
 *  "I asked this yesterday" pattern, short enough to bound storage. */
export const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Volatile answers (news / price / election / live score / "aujourd'hui"…)
 *  get a short TTL so a cached "who won the election" can't go stale. */
export const FRESH_TTL_MS = 30 * 60 * 1000;

/** A single embedding result. */
export type Embedder = (text: string) => Promise<number[]>;

/** Cached response returned by `tryGetCachedResponse`. */
export type CachedResponse = {
  query: string;
  response: string;
  metadata: Record<string, unknown>;
  similarity: number;
  hitType: 'exact' | 'semantic';
  cacheId: number;
};

/** Stop words.  Kept tiny — the goal is only to absorb the worst
 *  fillers ("the", "a", "an", "of") so "what is the capital of
 *  France" and "capital of France" hash the same.  We deliberately
 *  do NOT include domain terms (model names, country names, etc). */
const STOP_WORDS = new Set([
  // English fillers
  'a', 'an', 'the', 'of', 'in', 'on', 'at', 'to', 'for', 'is', 'are', 'was',
  'were', 'be', 'been', 'being', 'do', 'does', 'did', 'i', 'you', 'we', 'they',
  'me', 'my', 'your', 'our', 'what', 'whats', 'how', 'why', 'when', 'where', 'who',
  // French fillers + elisions (apostrophes are stripped → bare single letters)
  'le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'et', 'ou', 'au', 'aux',
  'ce', 'cet', 'cette', 'ces', 'est', 'sont', 'etre', 'qui', 'que', 'quoi',
  'quel', 'quelle', 'quels', 'quelles', 'comment', 'pourquoi', 'dans', 'sur',
  'pour', 'par', 'avec', 'en', 'je', 'tu', 'il', 'elle', 'nous', 'vous', 'ils',
  'elles', 'on', 'te', 'se', 'mon', 'ma', 'mes', 'ton', 'ta', 'tes', 'son',
  'sa', 'ses', 'notre', 'nos', 'votre', 'vos', 'leur', 'leurs', 'ne', 'pas',
  'plus', 'ca', 'cela', 'ceci',
  'c', 'd', 'j', 'l', 'm', 'n', 's', 't', 'qu',
]);

/** Strip accents/diacritics so "élection" == "election" and accented FR /
 *  African paraphrases collide on the same cache key. */
function foldDiacritics(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Keywords that make an answer time-sensitive (it goes stale fast). */
const VOLATILE_RE =
  /\b(aujourd|maintenant|actuel|actuelle|dernier|derniere|recent|recente|news|actu|actualite|prix|cours|taux|change|election|elections|resultat|resultats|score|match|meteo|weather|today|now|latest|breaking|live|direct|hier|demain|2026)\b/;

/**
 * True if the answer to this query is likely to go stale quickly (news, price,
 * live score, election, "aujourd'hui"…) — such answers get a short cache TTL.
 */
export function isVolatileQuery(query: string): boolean {
  return VOLATILE_RE.test(foldDiacritics(query.toLowerCase()));
}

/**
 * Lowercase, strip punctuation, drop stop words, sort the surviving
 * tokens, collapse whitespace.  Two semantically equivalent
 * questions should normalise to the same string regardless of word
 * order.  See the unit tests for the contract.
 */
export function normaliseQuery(input: string): string {
  return foldDiacritics(input.toLowerCase())
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0 && !STOP_WORDS.has(w))
    .sort()
    .join(' ')
    .trim();
}

/** 64-bit FNV-1a hash, hex string.  Matches the style of
 *  `embedCacheKey` so cache keys are predictable. */
export function hashQuery(input: string): string {
  const s = normaliseQuery(input);
  let h = BigInt('0xcbf29ce484222325');
  const prime = BigInt('0x100000001b3');
  const mask = (BigInt(1) << BigInt(64)) - BigInt(1);
  for (let i = 0; i < s.length; i++) {
    h = (h ^ BigInt(s.charCodeAt(i))) & mask;
    h = (h * prime) & mask;
  }
  return h.toString(16);
}

/** Lightweight facade so callers don't have to construct the store. */
let _store: SemanticCache | null = null;
function defaultStore(): SemanticCache {
  if (!_store) {
    _store = new SemanticCache();
  }
  return _store;
}

/** Test-only: inject a store.  Pass `null` to reset. */
export function setSemanticCacheStore(store: SemanticCache | null): void {
  _store = store;
}

/**
 * Look up a cached response.  Order:
 *   1. exact hash match (cheapest)
 *   2. cosine-similarity scan (BGE-M3, 1024 dims, linear scan OK for
 *      a few thousand rows)
 *
 * Returns null on miss.  Never throws — the caller falls back to the
 * live agent.
 */
export async function tryGetCachedResponse(
  query: string,
  embed: Embedder,
  opts: { threshold?: number; store?: SemanticCache } = {},
): Promise<CachedResponse | null> {
  const store = opts.store ?? defaultStore();
  const threshold = opts.threshold ?? COSINE_THRESHOLD;

  const normalised = normaliseQuery(query);
  if (!normalised) return null;
  const hash = hashQuery(normalised);

  // 1. Exact-hash fast path
  const exact = store.getByHash(hash);
  if (exact) {
    store.recordHit(exact.id);
    return {
      query: exact.query,
      response: exact.response,
      metadata: exact.metadata,
      similarity: 1,
      hitType: 'exact',
      cacheId: exact.id,
    };
  }

  // 2. Semantic scan
  const vec = await embed(normalised);
  const matches = store.scanSimilar(vec, threshold, 1);
  if (matches.length === 0) return null;
  const top = matches[0]!;
  store.recordHit(top.entry.id);
  return {
    query: top.entry.query,
    response: top.entry.response,
    metadata: top.entry.metadata,
    similarity: top.similarity,
    hitType: 'semantic',
    cacheId: top.entry.id,
  };
}

/** Insert (or refresh) a cached response. */
export async function cacheResponse(
  query: string,
  embedding: number[],
  response: string,
  opts: {
    metadata?: Record<string, unknown>;
    ttlMs?: number;
    store?: SemanticCache;
  } = {},
): Promise<number> {
  const store = opts.store ?? defaultStore();
  const normalised = normaliseQuery(query);
  // Volatile (news/price/election) answers expire fast so they can't go stale.
  const volatile = isVolatileQuery(query);
  return store.upsert({
    query: normalised,
    queryHash: hashQuery(normalised),
    embedding,
    response,
    metadata: { ...(opts.metadata ?? {}), freshnessClass: volatile ? 'volatile' : 'stable' },
    ttlMs: opts.ttlMs ?? (volatile ? FRESH_TTL_MS : DEFAULT_TTL_MS),
  });
}

/** Read-only cache stats. */
export function getCacheStats(
  opts: { store?: SemanticCache } = {},
): { size: number; hits: number } {
  const store = opts.store ?? defaultStore();
  return store.stats();
}

export { SemanticCache, cosineSimilarity };
