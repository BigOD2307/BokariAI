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
import { createHash } from 'crypto';
import { SemanticCache, cosineSimilarity } from './store';

/**
 * What makes two identical-looking queries actually different requests.
 *
 * The cache used to key on the normalised query alone — mode, conversation
 * history, uploaded files and enabled sources never entered the key. A
 * follow-up like "et au Sénégal ?" could return whatever conversation last
 * cached that exact phrase, from a different user, in a different context
 * (BUG-25); a hit also returned a single text block with no `source` block,
 * so any `[n]` citations in the cached prose pointed at nothing.
 */
export type CacheScope = {
  mode: string;
  /** Hash of the recent conversation turns — a follow-up is not a fresh query. */
  historyHash: string;
  /** Uploaded file ids: an answer grounded in a private PDF is never shared. */
  fileIds: string[];
  sources: string[];
};

/** Deterministic fingerprint of a scope. Folded into the cache key AND
 *  stored in each entry's metadata, so the semantic (cosine) scan can be
 *  filtered to the same scope, not just the exact-hash fast path. */
export function scopeKey(scope: CacheScope): string {
  return createHash('sha256')
    .update(JSON.stringify([scope.mode, scope.historyHash, [...scope.sources].sort()]))
    .digest('hex')
    .slice(0, 16);
}

/** A request grounded in user-uploaded files is never cacheable — reading
 *  or writing it would leak (or serve stale) private document content. */
export function isCacheable(scope: CacheScope): boolean {
  return scope.fileIds.length === 0;
}

/** Stable fingerprint of the recent conversation, for CacheScope.historyHash.
 *  Order-sensitive on purpose: the same question after a different prior
 *  turn is a different request. */
export function hashHistory(history: ReadonlyArray<readonly [string, string]>): string {
  return createHash('sha256').update(JSON.stringify(history)).digest('hex').slice(0, 16);
}

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
  /** The 'source' block's data at cache-write time — a hit replays the
   *  answer WITH its citations resolvable, not a bare text blob (BUG-25). */
  sources: unknown[];
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
 *   1. exact hash match, scoped to `scope` (cheapest)
 *   2. cosine-similarity scan (BGE-M3, 1024 dims, linear scan OK for
 *      a few thousand rows), filtered to entries with the same scope
 *
 * `scope` is mandatory: mode, conversation history and enabled sources all
 * change what a "matching" cache entry means, and a request grounded in
 * uploaded files is never cacheable at all (isCacheable).
 *
 * Returns null on miss (including "not cacheable").  Never throws — the
 * caller falls back to the live agent.
 */
export async function tryGetCachedResponse(
  query: string,
  embed: Embedder,
  scope: CacheScope,
  opts: { threshold?: number; store?: SemanticCache } = {},
): Promise<CachedResponse | null> {
  if (!isCacheable(scope)) return null;

  const store = opts.store ?? defaultStore();
  const threshold = opts.threshold ?? COSINE_THRESHOLD;
  const scoped = scopeKey(scope);

  const normalised = normaliseQuery(query);
  if (!normalised) return null;
  const hash = `${hashQuery(normalised)}:${scoped}`;

  // 1. Exact-hash fast path
  const exact = store.getByHash(hash);
  if (exact) {
    store.recordHit(exact.id);
    return {
      query: exact.query,
      response: exact.response,
      sources: Array.isArray(exact.metadata.sources) ? (exact.metadata.sources as unknown[]) : [],
      metadata: exact.metadata,
      similarity: 1,
      hitType: 'exact',
      cacheId: exact.id,
    };
  }

  // 2. Semantic scan, then filter to the same scope. Cosine similarity knows
  //    nothing about mode/history/sources, so an unfiltered top-1 could
  //    serve a match from a completely different conversation.
  const vec = await embed(normalised);
  const matches = store
    .scanSimilar(vec, threshold, 20)
    .filter((m) => m.entry.metadata.scopeKey === scoped);
  if (matches.length === 0) return null;
  const top = matches[0]!;
  store.recordHit(top.entry.id);
  return {
    query: top.entry.query,
    response: top.entry.response,
    sources: Array.isArray(top.entry.metadata.sources) ? (top.entry.metadata.sources as unknown[]) : [],
    metadata: top.entry.metadata,
    similarity: top.similarity,
    hitType: 'semantic',
    cacheId: top.entry.id,
  };
}

/** Insert (or refresh) a cached response. Refuses to write anything for a
 *  non-cacheable scope (file-grounded requests) — see isCacheable. */
export async function cacheResponse(
  query: string,
  embedding: number[],
  response: string,
  scope: CacheScope,
  opts: {
    sources?: unknown[];
    metadata?: Record<string, unknown>;
    ttlMs?: number;
    store?: SemanticCache;
  } = {},
): Promise<number | null> {
  if (!isCacheable(scope)) return null;

  const store = opts.store ?? defaultStore();
  const normalised = normaliseQuery(query);
  // Volatile (news/price/election) answers expire fast so they can't go stale.
  const volatile = isVolatileQuery(query);
  return store.upsert({
    query: normalised,
    queryHash: `${hashQuery(normalised)}:${scopeKey(scope)}`,
    embedding,
    response,
    metadata: {
      ...(opts.metadata ?? {}),
      scopeKey: scopeKey(scope),
      sources: opts.sources ?? [],
      freshnessClass: volatile ? 'volatile' : 'stable',
    },
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
