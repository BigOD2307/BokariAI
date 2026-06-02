/**
 * @module ai/reranker
 * @description Cross-encoder rerank stage for the Bokari citation engine.
 *
 *   1. The hybrid ranker (BM25 + cosine) produces a top-50 of *candidates*.
 *   2. The cross-encoder reranker scores *every (query, document) pair
 *      jointly* and returns a top-N in relevance order.
 *   3. NDCG@10 goes up 3-10 points (vs bi-encoder cosine), at the
 *      cost of one extra ~$0.0025/query call.
 *
 * Two implementations live in this file:
 *
 *   - `OpenRouterReranker`  : real call to https://openrouter.ai/api/v1/rerank
 *     using the same `OPENROUTER_API_KEY` as the embedding provider.
 *     Retries 2x on 5xx/429.  No fallback to another provider — if
 *     OpenRouter is down, the user sees an honest error.
 *
 *   - `OfflineReranker`     : deterministic token-overlap scorer.
 *     Same shape as the live one, no network.  Used in tests + CI so
 *     the regression gate stays free and deterministic.  Well-
 *     correlated with the live cross-encoder on our eval (measured
 *     +0.04 on a 5-query micro-eval, see PHASE-9 doc).
 *
 * The factory `getReranker()` picks between them based on
 * `getRerankConfig()`.  In V1 the only knob is the `mode` flag on
 * `RankOptions.rerank` — `live` runs the OpenRouter call, `offline`
 * uses the deterministic mock.  Tests and CI default to `offline`.
 *
 * @author Amadou — Dicken AI
 * @version 1.0.0
 */

/** A single document to rerank.  `id` is whatever the caller uses to
 *  map back to its `Article` (we use the article `id` or `url`). */
export type RerankDocument = {
  id: string;
  text: string;
};

/** One rerank hit.  `index` is the original index in the input list,
 *  preserved by OpenRouter so callers can rebuild the order. */
export type RerankResult = {
  id: string;
  score: number;
  index: number;
};

/** Configuration for the live OpenRouter reranker. */
export type OpenRouterRerankConfig = {
  apiKey: string;
  model: string;
  /** OpenAI-style baseURL override.  Default: https://openrouter.ai/api/v1. */
  baseURL?: string;
  /** Max retries on 5xx/429.  Default 2. */
  retries?: number;
};

const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';
const DEFAULT_RETRIES = 2;
const RETRY_BACKOFF_MS = 350;

/** The Bokari rerank configuration.  Lives next to the chat / embed
 *  config in `ai/config.ts` and is read at call time. */
export type RerankConfig = {
  provider: 'openrouter';
  model: string;
  enabled: boolean;
};

/** Read the rerank config from env.  Defaults: openrouter / BGE-reranker-v2-m3 / disabled. */
export function getRerankConfig(): RerankConfig {
  return {
    provider: 'openrouter',
    model: process.env.BOKARI_RERANK_MODEL || 'baai/bge-reranker-v2-m3',
    enabled: process.env.BOKARI_RERANK_ENABLED === 'true',
  };
}

/* ------------------------------------------------------------------ *
 * OpenRouterReranker
 * ------------------------------------------------------------------ */

export class OpenRouterReranker {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseURL: string;
  private readonly retries: number;

  constructor(config: OpenRouterRerankConfig) {
    if (!config.apiKey) {
      throw new Error('[ai/reranker] OpenRouterReranker requires an apiKey');
    }
    if (!config.model) {
      throw new Error('[ai/reranker] OpenRouterReranker requires a model');
    }
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.baseURL = config.baseURL || DEFAULT_BASE_URL;
    this.retries = config.retries ?? DEFAULT_RETRIES;
  }

  /**
   * Score `docs` against `query` and return up to `topN` results
   * sorted by descending relevance.  If `topN` is undefined, all
   * docs are returned (the OpenRouter API defaults to top_n=10
   * server-side; we override that to undefined so it returns the
   * full list).
   */
  async rank(query: string, docs: RerankDocument[], topN?: number): Promise<RerankResult[]> {
    if (!query || docs.length === 0) return [];
    const url = `${this.baseURL}/rerank`;
    const body: Record<string, unknown> = {
      query,
      model: this.model,
      documents: docs.map((d) => d.text),
    };
    if (typeof topN === 'number') body.top_n = topN;

    const res = await this.withRetry(() => this.post(url, body));
    return this.mapResponse(res, docs);
  }

  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastErr: unknown;
    for (let i = 0; i <= this.retries; i++) {
      try {
        return await fn();
      } catch (err: any) {
        lastErr = err;
        const status = err?.status;
        // Only retry on known-retryable statuses.  Network errors
        // (no status) are also retryable.  Anything else (401, 403,
        // 400) is a hard fail — retrying won't fix a bad key.
        const retryable =
          status === 429 ||
          (typeof status === 'number' && status >= 500) ||
          (typeof status !== 'number');
        if (!retryable || i === this.retries) break;
        const wait = RETRY_BACKOFF_MS * Math.pow(2, i);
        console.warn(
          `[ai/reranker] retry ${i + 1}/${this.retries} after ${wait}ms: ${err?.message ?? err}`,
        );
        await new Promise((r) => setTimeout(r, wait));
      }
    }
    throw lastErr;
  }

  private async post(url: string, body: unknown): Promise<any> {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        // OpenRouter ranks Bokari on the leaderboard if we send these.
        'HTTP-Referer': 'https://bokari.ai',
        'X-Title': 'Bokari',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      // Try to read the error body, but be defensive — mocks and
      // some real responses (204, 304, etc.) may not have one.
      let detail = '';
      try {
        if (typeof res.text === 'function') {
          detail = await res.text();
        }
      } catch {
        // ignore — empty detail is fine
      }
      if (!detail && typeof res.json === 'function') {
        try {
          const j = await res.json();
          detail = (j as any)?.error?.message ?? JSON.stringify(j);
        } catch {
          // ignore
        }
      }
      const err: any = new Error(
        `[ai/reranker] OpenRouter ${res.status}${detail ? `: ${detail}` : ''}`,
      );
      err.status = res.status;
      throw err;
    }
    return res.json();
  }

  private mapResponse(res: any, docs: RerankDocument[]): RerankResult[] {
    const results = Array.isArray(res?.results) ? res.results : [];
    return results
      .map((r: any): RerankResult | null => {
        const idx = typeof r.index === 'number' ? r.index : -1;
        const score = typeof r.relevance_score === 'number' ? r.relevance_score : 0;
        const doc = idx >= 0 && idx < docs.length ? docs[idx] : null;
        if (!doc) return null;
        return { id: doc.id, score, index: idx };
      })
      .filter((x: RerankResult | null): x is RerankResult => x !== null);
  }
}

/* ------------------------------------------------------------------ *
 * OfflineReranker — deterministic, used in tests + CI
 * ------------------------------------------------------------------ */

const STOPWORDS = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'au', 'aux',
  'a', 'et', 'ou', 'en', 'on', 'il', 'elle', 'ils', 'elles',
  'the', 'a', 'an', 'of', 'in', 'on', 'at', 'to', 'for', 'and', 'or',
  'is', 'are', 'was', 'were', 'be', 'been',
]);

function tokens(s: string): string[] {
  return (s.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []).filter(
    (t) => t.length >= 2 && !STOPWORDS.has(t),
  );
}

export class OfflineReranker {
  /**
   * Deterministic token-overlap scorer.  For each document, the score
   * is the Jaccard-like overlap between the document tokens and the
   * query tokens, with a small length penalty to break ties.
   *
   * This is intentionally simple — it's *not* a real cross-encoder
   * and we never ship it to production.  Its only job is to be a
   * stable, free-of-cost signal for the CI gate, well-correlated
   * enough with the live reranker to catch rank-reorder regressions
   * (see PHASE-9 doc §4 for the +0.04 micro-eval measurement).
   */
  async rank(query: string, docs: RerankDocument[], topN?: number): Promise<RerankResult[]> {
    if (!query || docs.length === 0) return [];
    const q = new Set(tokens(query));
    if (q.size === 0) {
      // No usable query tokens; preserve order.
      return docs.map((d, i) => ({ id: d.id, score: 0, index: i }));
    }
    const scored: RerankResult[] = docs.map((d, i) => {
      const dtoks = new Set(tokens(d.text));
      let hits = 0;
      for (const t of q) if (dtoks.has(t)) hits++;
      // Jaccard: |A∩B| / |A∪B|; we weight by query coverage (|A∩B| / |A|)
      // to penalise short docs that happen to contain one query term.
      const coverage = hits / q.size;
      const density = dtoks.size > 0 ? hits / dtoks.size : 0;
      // 70% coverage (recall) + 30% density (precision).  Both in [0,1].
      const score = Math.max(0, Math.min(1, 0.7 * coverage + 0.3 * density));
      return { id: d.id, score, index: i };
    });
    scored.sort((a, b) => b.score - a.score);
    return typeof topN === 'number' ? scored.slice(0, topN) : scored;
  }
}

/* ------------------------------------------------------------------ *
 * Factory
 * ------------------------------------------------------------------ */

/**
 * Return the reranker instance for the given mode.  The mode is set
 * by `RankOptions.rerank.mode` (the caller picks per-query) — but if
 * mode is `'live'` and no API key is configured, we *silently* fall
 * back to `OfflineReranker` rather than throwing.  Rerank is a
 * quality-of-results boost, not a correctness requirement.
 */
export function getReranker(
  mode: 'live' | 'offline',
): OpenRouterReranker | OfflineReranker {
  if (mode === 'live') {
    const apiKey = process.env.OPENROUTER_API_KEY;
    const model = process.env.BOKARI_RERANK_MODEL || 'baai/bge-reranker-v2-m3';
    if (apiKey) {
      return new OpenRouterReranker({ apiKey, model });
    }
    console.warn(
      '[ai/reranker] mode=live but OPENROUTER_API_KEY is missing — falling back to OfflineReranker. ' +
        'Set the key in .env to enable the real cross-encoder.',
    );
  }
  return new OfflineReranker();
}
