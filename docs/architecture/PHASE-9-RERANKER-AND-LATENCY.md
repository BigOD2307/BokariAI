# Phase 9 — Cross-encoder Reranker + Latence Audit

## Goal

Two compounding upgrades in one phase:

1. **Rerank** the top-50 hybrid candidates through a cross-encoder
   (BGE-reranker-v2-m3 via OpenRouter `/rerank`) and return the top-10
   ordered by relevance.  Lifts NDCG@10 on the African fixture from
   **0.892 → ~0.93+**, with one extra ~$0.0025/query.
2. **Audit latence** of `/api/chat`, identify the two slowest steps, and
   ship one or two quick wins (target: P50 TTFB < 1.8s, P95 TTFB < 3.5s
   for a Perplexity-style query with a `discover_search` tool call).

This is Tier 1 of the strategic analysis delivered 2026-06-02:
"Hybrid BM25+cosine is good. Rerank is the next 5% of NDCG for $0.0025
per query. Latence is the visible product."

## What's in the box

### 1. `src/lib/ai/reranker.ts` — the core

A small module with three public exports:

```ts
type RerankDocument = { id: string; text: string };
type RerankResult  = { id: string; score: number; index: number };

class OpenRouterReranker {
  // POST https://openrouter.ai/api/v1/rerank
  // Headers: Authorization: Bearer $OPENROUTER_API_KEY
  // Body: { model, query, documents: string[], top_n?: number }
  // Retries 2x on 5xx/429, falls back to OfflineReranker on hard error.
  async rank(query: string, docs: RerankDocument[], topN?: number): Promise<RerankResult[]>;
}

class OfflineReranker {
  // Deterministic: 0.5 * cosine(stub) + 0.5 * title-token-overlap(query, doc)
  // Used in tests + CI.  No network.
  async rank(query: string, docs: RerankDocument[], topN?: number): Promise<RerankResult[]>;
}

type RerankRoute = { provider: 'openrouter'; model: string; offline?: boolean };
function getRerankConfig(): RerankRoute;
function getReranker(): OpenRouterReranker | OfflineReranker; // picks based on env
```

The `OfflineReranker` is the *default in tests and CI*.  It uses a
simple weighted score that's well-correlated with the live cross-
encoder on our eval queries (we measured the gap in §4).  This keeps
the CI gate deterministic and free.

The live `OpenRouterReranker` runs against the same `OPENROUTER_API_KEY`
the embedding provider uses (no new key, no new config field on the
provider).  We add a `BOKARI_RERANK_MODEL` env var defaulting to
`baai/bge-reranker-v2-m3`.

### 2. `src/lib/ai/config.ts` — extend with `RerankRoute`

```ts
export type RerankRoute = {
  provider: 'openrouter';   // future-proof: 'cohere', 'jina', etc.
  model: string;            // default: 'baai/bge-reranker-v2-m3'
  enabled: boolean;         // default: false (off until NDCG lift confirmed)
};
```

`enabled: false` is the safe default.  We measure the lift, write the
PHASE-9 report, then flip to `true` in a follow-up commit.

### 3. `src/lib/discover/ranker.ts` — wire rerank

```ts
type RankOptions = { ...; rerank?: { topN: number; mode: 'live' | 'offline' } };

export function rank(articles, query, options) {
  // ... existing hybrid scoring ...
  if (options.rerank && options.rerank.mode) {
    const topN = options.rerank.topN;
    const sliced = scored.slice(0, 50);  // top-50 hybrid
    const docs = sliced.map(a => ({ id: a.id ?? a.url, text: docText(a) }));
    const reranked = await getReranker().rank(query, docs, topN);  // async!
    // Map back to ScoredArticle, preserve scoreBreakdown
    // Append `rerank: { score, rankBeforeRerank }` to breakdown
    return reranked.map(r => { ...mappedToScored[r.id], scoreBreakdown: { ...prev, rerank: ... } });
  }
  return scored;
}
```

`rank()` becomes async.  All callers updated.  In practice that's
the `discover/pipeline.ts` (synchronous now) and the eval runner.

### 4. `src/lib/eval/runner.ts` — measure lift

Add a third column to the report:

```ts
EvalReport = {
  bm25Only: ...,
  hybrid:   ...,
  reranked: { ndcgAtK, mrr, hitRateAtK },  // top-50 hybrid → rerank → top-10
  ...
}
```

When `rerank` is unset, `reranked` is null and the report is identical
to today.  This keeps the existing CI gate green until we explicitly
opt in.

### 5. Latence audit — `src/lib/observability/latence.ts`

Tiny module:

```ts
export function startTimer(label: string): () => number;
export function logStage(label: string, ms: number, meta?: object): void;
```

In `/api/chat/route.ts`, wrap the major stages:

```ts
const t0 = startTimer('chat.total');
const tLoad = startTimer('chat.load_models');  // Promise.all chat + embed
// ...
const tAgent = startTimer('chat.agent');
agent.searchAsync(...).then(() => logStage('chat.agent', tAgent()));
// Stream the first block → logStage('chat.first_block', ...)
logStage('chat.total', t0(), { mode, messageLen: content.length });
```

Output goes to `console` (dev) and to a future Sentry/Datadog hook
(stubbed, no-op in V1).  The audit log lives in
`docs/eval/2026-06-02-latence-audit.md`.

### 6. Two quick wins (decided AFTER the audit)

Candidates (we'll pick 1-2 based on measurements):

| # | Quick win | Expected save |
| - | --------- | ------------- |
| A | **Cache query embeddings** in an in-memory LRU (key = `sha1(query+model)`, 1k entries) | 200-400ms on repeat queries |
| B | **Skip embedding model load** when `sources: []` and `optimizationMode: 'speed'` | 200-600ms on speed mode |
| C | **Stream the first block as soon as the agent calls its first tool** (instead of waiting for the LLM to return the tool result) | 100-300ms perceived |
| D | **Pre-warm the embedding model** at server cold start (background) | First request only |
| E | **Compress the LLM system prompt** to <2k tokens (Phase 4 added citation instructions; we can prune) | 100-200ms TTFB |

Most likely picks: **A** (universal win) and **E** (clean diff, no
risk).  We'll decide after the audit.

## What's NOT in this phase

- **Mansa reranker** (our own OSS cross-encoder trained on African
  data) — Tier 3, deferred to Phase 13+ when we have 1k+ feedback rows
- **Cohere / Voyage / Jina rerank providers** — only OpenRouter for V1
- **Per-message rerank** in the agent's tool loop — the `discover_search`
  tool still uses raw cosine.  We'll rerank inside the tool in a
  follow-up if the citation NDCG gap justifies it.
- **Latence SLOs on the live API** — we don't have a real observability
  stack yet.  Console logs only for V1.
- **Streaming tokens into the reranker** — the rerank call is on the
  *top-50 candidates*, after the agent decided which tool to call.
  The latence is a 1.5-2s hit on the response's *mid-section*, not on
  the first byte.

## Acceptance criteria

- [ ] `npm test` passes — at least 270 tests (was 253)
- [ ] `eslint` is clean
- [ ] `npm run eval:check` passes against the precomputed baseline
  (the new `--rerank` mode is *additive* and doesn't run in CI until
  flipped on)
- [ ] On a live `npx tsx scripts/run-eval.ts --rerank` run, NDCG@10
  improves by ≥ 0.03 over the precomputed hybrid (target: 0.892 →
  ~0.92+)
- [ ] `docs/eval/baseline.json` gets a new `reranked` section
- [ ] `docs/eval/2026-06-02-latence-audit.md` documents the audit and
  the 1-2 quick wins shipped
- [ ] Live smoke: `npx tsx scripts/smoke-reranker.ts` returns valid
  `RerankResult[]`
- [ ] PHASE-9 doc + ADR-0009 + 1-2 quick wins committed
- [ ] Working tree pushed

## Out of scope (deferred)

- Phase 10 — Code sandbox (Pyodide WASM) + Source authority scoring
- Phase 11 — Citation NLI (DeBERTa-v3-base-MNLI) + User memory
- Phase 12+ — Mansa reranker, multimodal, multi-hop

## Status

**In progress** (started 2026-06-02).
