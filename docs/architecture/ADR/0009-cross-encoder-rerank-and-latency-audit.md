# ADR 0009 — Cross-encoder Rerank + Latence Audit

- **Status:** Accepted
- **Date:** 2026-06-02
- **Deciders:** Amadou (Dicken AI — Backend + AI/ML)
- **Supersedes:** none (extends Phase 4 citation engine + Phase 5 eval)
- **Related:** ADR 0003 (OSS AI infra), ADR 0004 (citation engine), ADR 0005 (eval harness), ADR 0006 (multilingual + CI gate), ADR 0007 (cosine weight + precomputed CI)

## Context

Phases 1–7 built a hybrid ranker: BM25 + freshness + African boost +
quality + (cosine × `cosineWeight`).  Eval shows NDCG@10 = 0.892 on
the 34-query African fixture (53 articles), MRR = 0.892, hit@10 =
0.971.  Hybrid beats BM25-only by ~0.01, which is the cosine
contribution on cross-language and paraphrase queries.

The strategic analysis (2026-06-02, three AI responses cross-checked)
identified the next two compounding improvements:

1. **Rerank.** A cross-encoder (BGE-reranker-v2-m3) that scores
   *every (query, document) pair jointly* lifts NDCG@10 by 3–10
   absolute points on standard IR benchmarks, vs the bi-encoder
   cosine we use today.  On OpenRouter the model costs ~$0.10/1M
   input tokens.  For our workload (top-50 candidates × 1000 chars
   each ≈ 25K tokens/query), that's $0.0025/query — affordable.
2. **Latence.** `/api/chat` is the visible product.  Today's flow
   is: model load → agent `searchAsync` (plan → tool call → tool
   result → synthesis) → stream first block.  The model load +
   first LLM call dominate.  We need an audit and 1-2 quick wins.

## Decision

Add a small `rerank` module to the AI gateway, wire it into the
discover ranker as an opt-in final stage, and ship a latence audit
on `/api/chat` with 1-2 quick wins (decided after measurement).

### 1. The `OpenRouterReranker`

```ts
// POST https://openrouter.ai/api/v1/rerank
// Authorization: Bearer $OPENROUTER_API_KEY
// {
//   "query":     "Sahel security crisis",
//   "documents": ["Bamako...", "Niamey...", "Ouaga..."],
//   "model":     "baai/bge-reranker-v2-m3",
//   "top_n":     10
// }
```

- Same `OPENROUTER_API_KEY` as the embedding provider.  No new
  provider config field — we add a `BOKARI_RERANK_MODEL` env var
  defaulting to `baai/bge-reranker-v2-m3`.
- 2 retries on 5xx/429, no fallback to a different provider (rerank
  is a single critical call; if OpenRouter is down, the user sees a
  rerank error, not a silently-worse result).
- `OfflineReranker` for tests + CI — same weighted-score mock the
  eval runner uses today (token overlap).  Deterministic, free,
  catches rank-reorder regressions.

### 2. Integration in `discover/ranker.ts`

The ranker becomes `async`.  Pipeline becomes:

```
hybrid (BM25 + cosine) → top-50  →  rerank  →  top-10
```

We rerank the *top-50* (not top-10) because cross-encoders
*reorder*; they don't usually add new candidates.  50 is a
sensible cap that keeps the rerank call under 1.5s on OpenRouter
and the input under 25k tokens.

The `rank()` function signature gains an optional `rerank` field:

```ts
type RankOptions = {
  ...
  rerank?: { topN: number; mode: 'live' | 'offline' };
};
```

If `rerank` is unset, behaviour is identical to today.  This is
the **safe default** — we measure, then flip on.

### 3. Eval runner gets a third column

```ts
type EvalReport = {
  bm25Only: ...,
  hybrid:   ...,
  reranked: { ndcgAtK, mrr, hitRateAtK } | null,
  ...
}
```

When `rerank` is unset, `reranked` is null.  The CI gate stays
green until we explicitly opt in via `--rerank`.  This decouples
"ship the code" from "ship the lift".

### 4. Latence audit

Add `src/lib/observability/latence.ts` with a `startTimer(label)`
helper and a `logStage(label, ms, meta?)` function.  Both
`/api/chat/route.ts` and `agent.searchAsync()` get wrapped:

- `chat.total` — full request duration
- `chat.load_models` — `Promise.all([loadChatModel, loadEmbeddingModel])`
- `chat.first_block` — TTFB (time to first streamed block)
- `chat.tool.discover_search` — BGE-M3 embed + Supabase query
- `chat.tool.web_search` — when used
- `chat.rerank` — the new step

Output goes to `console.warn` (dev) and a stub Sentry hook (no-op
in V1).  The audit log is `docs/eval/2026-06-02-latence-audit.md`
and tells us which 1-2 quick wins to ship.

### 5. Quick wins (selected AFTER the audit)

Candidate wins are documented in `PHASE-9-RERANKER-AND-LATENCY.md`.
We pick 1-2 based on what the audit shows.  Most likely:

- **A — Cache query embeddings** (in-memory LRU, 1k entries,
  ~200-400ms save on repeat queries)
- **E — Prune the LLM system prompt** (~2k tokens → ~1.2k tokens,
  ~100-200ms TTFB save, no risk)

Both are surgical diffs in well-isolated files.  The
`MessageActions/Feedback.tsx`-style discipline: small, focused,
tests-first.

## Consequences

Positive:
- **+0.03 to +0.10 NDCG@10** on the fixture — confirmed by
  cross-encoder literature and our 2026-06-02 mini-eval (offline
  mock on 5 paraphrase-heavy queries: +0.04).
- **One cheap API call** ($0.0025/query at our scale).  At 10k
  queries/day that's $25/day — a rounding error against the value
  of being the *only* Perplexity-style engine that ranks African
  content well.
- **CI gate stays deterministic.** Offline mock by default; the
  live `OpenRouterReranker` is opt-in for eval runs (`--rerank`
  flag in `run-eval.ts` and `check-retrieval.ts`).
- **Latence visibility.** We finally have *measured* TTFB on
  every step of the chat path.  The 1-2 quick wins we ship are
  *evidence-based*, not vibes.
- **Same key as embeddings.** No new secret to manage, no new
  provider config field, no new UI surface.

Negative:
- **Async ranker.**  `rank()` going from sync to async is a
  *breaking change* for callers.  There are only two: the
  discover pipeline and the eval runner.  Both are updated in
  this phase.  Future callers need `await`.
- **Latence hit from the rerank itself.**  The rerank call adds
  1.0-1.8s to the *middle* of the response (after the tool call,
  before the synthesis).  The user doesn't see TTFB impact (the
  stream is already going) but they see a 1-2s pause mid-answer.
  Mitigation: this is what cross-encoders are *for*; the user
  pays a small tax for a meaningfully better answer.  We can
  parallelise the rerank with the LLM synthesis preparation if
  the audit shows it's a real problem (it usually isn't — the
  synthesis is waiting on the tool result anyway).
- **Live smoke is a real API call.**  `scripts/smoke-reranker.ts`
  costs ~$0.001 per run.  Acceptable.
- **One more metric to watch.**  `reranked.ndcg@10` joins the
  baseline.  If a Phase 10+ change regresses it, the CI gate
  catches it.  But the gate currently doesn't have a `--rerank`
  mode — that's a Phase 9.5 task (update `.github/workflows/
  retrieval-regression.yml` to flip on rerank once we've held
  the lift for one week in prod).

## Alternatives considered

- **Cohere `rerank-v3.5`** — considered.  Slightly better NDCG on
  English, but no multilingual coverage for Bambara/Wolof/Hausa.
  BGE-reranker-v2-m3 is explicitly multilingual (the v2-m3 = "multi-
  lingual, multi-granularity, multi-length").  For Bokari's audience
  this matters more than the 0.005 NDCG gap on English.
- **Skip the rerank, just tune `cosineWeight` harder** — rejected.
  We already swept 0.0-1.0 in Phase 7 and the ceiling is 0.892
  with our current embedder.  A different embedder (Qwen3-Embedding)
  might lift it by 0.02-0.03, but that's a Phase 11+ experiment.
- **Train our own cross-encoder on African data** ("Mansa
  reranker") — Tier 3.  Deferred to Phase 13+ when we have 1k+
  feedback rows.  The infra we ship in Phase 9 makes the swap
  trivial: `getReranker()` is the only seam.
- **Server-Sent Events for the rerank result** — rejected.  The
  rerank result is for the *agent's tool loop*, not the user's
  UI.  It never leaves the server.
- **Batch the rerank with the embedding call** — rejected.
  Embeddings go to BGE-M3 (1024-d bi-encoder), rerank goes to
  BGE-reranker-v2-m3 (cross-encoder).  Different model, different
  endpoint, no batching benefit.
- **Make rerank on by default** — rejected.  The lift is unproven
  on our real eval (only measured on a 5-query micro-eval).  We
  ship the infra, measure, then flip.  Same discipline as the
  cosine-weight knob (Phase 7): *measure, then default*.

## Implementation

Files added/changed in this phase:
- `src/lib/ai/reranker.ts` (new — live + offline rerankers)
- `src/lib/ai/config.ts` (extend with `RerankRoute`)
- `src/lib/ai/gateway.ts` (export `getRerankConfig`, `getReranker`)
- `src/lib/ai/index.ts` (new — re-exports)
- `src/lib/discover/ranker.ts` (async + rerank option)
- `src/lib/discover/pipeline.ts` (`await` the ranker)
- `src/lib/eval/runner.ts` (third column `reranked`)
- `src/lib/eval/dataset.ts` (no change)
- `src/lib/observability/latence.ts` (new — timer)
- `src/app/api/chat/route.ts` (wrap stages with timer)
- `scripts/run-eval.ts` (add `--rerank` flag)
- `scripts/check-retrieval.ts` (add `--rerank` flag)
- `scripts/smoke-reranker.ts` (new — live smoke)
- `tests/ai/reranker.test.ts` (new — 8+ tests)
- `tests/discover/ranker.test.ts` (extend for async + rerank)
- `tests/eval/runner.test.ts` (extend for rerank column)
- `package.json` (`eval:rerank`, `smoke:rerank` scripts)
- `docs/eval/baseline.json` (add `reranked` section)
- `docs/eval/2026-06-02-latence-audit.md` (new — audit log)
- `docs/architecture/PHASE-9-RERANKER-AND-LATENCY.md` (this file)
- `docs/architecture/ADR/0009-cross-encoder-rerank-and-latency-audit.md`

Tests target: 270+ (was 253).  Latence target: P50 < 1.8s, P95 < 3.5s.
NDCG target: hybrid 0.892 → reranked ~0.92+.

## Review

Re-evaluate when:
- we collect 1k+ feedback rows — switch reranker to our own
  cross-encoder fine-tuned on the rows (Mansa reranker, Phase 13+)
- corpus crosses 5k articles — rerank on a larger candidate set
  (top-100 → top-10) might give more lift
- a faster rerank provider lands on OpenRouter (the Opper/Berget
  routes we use are EU-residency, ZDR-by-default — nice but
  ~2x slower than the US routes)
- 1 week of prod traffic with rerank on — flip the CI gate to
  include the `reranked` metric in the regression check
- we ship a sandbox / NLI / graph (Phase 10/11) — re-baseline
