# Phase 9 — Latence Audit & Quick Wins

**Date** : 2026-06-02
**Author** : Amadou (Dicken AI)
**Status** : Shipped in working tree, pending commit
**Companion doc** : [`PHASE-9-RERANKER-AND-LATENCY.md`](./PHASE-9-RERANKER-AND-LATENCY.md), [`ADR/0009-cross-encoder-rerank-and-latency-audit.md`](./ADR/0009-cross-encoder-rerank-and-latency-audit.md)

---

## Goal

Make `/api/chat` measurable, then ship the highest-leverage quick wins
*before* the rerank changes.  We can't optimise what we can't see.

## What's in the box

1. **`src/lib/observability/latence.ts`** — three small helpers built on
   `process.hrtime.bigint()` :
   - `startTimer()` returns a closure that, when called, returns the
     elapsed milliseconds and freezes the value (so logging twice gives
     the same number, no double-counting).
   - `logStage(label, ms, meta?)` writes `[latence] <label>=<X.Xms> <meta-json>`
     to `console.warn` so it shows up alongside other server warnings.
   - `stage(label, meta?)` is the sugar version : `const end = stage('chat.parse'); end({ extra });`.
2. **Instrumented `/api/chat`** — six stages now log latence:
   - `chat.parse` — body parse + zod validation
   - `chat.load_models` — `ModelRegistry.loadChatModel + loadEmbeddingModel` (in `Promise.all`)
   - `chat.auth` — Supabase `auth.getUser()`
   - `chat.first_block` — first `block` event from the agent (= TTFB from the user's perspective)
   - `chat.agent` — full `agent.searchAsync()` resolution
   - `chat.total` — full request, logged on `end` and `error`
3. **Win A — Query-embedding LRU cache** (`src/lib/ai/embedCache.ts`) :
   - 1k-entry `Map`, LRU eviction, FNV-1a key on `(model, text)`.
   - Wired into `embedOne()` (the user-query path), *not* `embed()`
     (the batch path used for fixture precompute — every input is
     unique, caching would just burn memory).
   - Disable with `BOKARI_EMBED_CACHE_DISABLED=true` for A/B tests.
   - Test count : **11 new tests**, see `tests/ai/embed-cache.test.ts`.

## Why we did not ship Win B / C

| Win | Why deferred |
| --- | --- |
| **B. Skip embedding-model load when no citation needed** | We don't know in advance which tools the agent will pick.  Cheap for OpenRouter (HTTP, ~50ms / `loadEmbeddingModel` is just `new OpenRouterEmbedding()`), but valuable for local providers (Ollama, lemonade).  Needs a model-registry-level warm-cache: tracked as **Phase 9.5**. |
| **C. Semantic result cache (same query → same answer)** | Real-world repeated queries are usually follow-ups in a chat, where the answer depends on the chat history.  The marginal value over the embedding cache is small.  Revisit at 100k+ WPU. |
| **D. Stream first block earlier (synthetic TTFB)** | Requires a rewrite of `SearchAgent` to short-circuit the tool-decision step.  Big lever but out of scope for Phase 9. |
| **E. Prune LLM system prompt < 2k tokens** | Real win, but needs a careful pass on the agent prompt — touching the prompt is high-risk and the impact is hard to measure in isolation.  Tracked as **Phase 9.5**. |

## Acceptance criteria (for this box)

- [x] `latence.ts` has unit tests covering `startTimer`, `logStage`, `stage` (frozen value, meta merge, empty input).
- [x] `/api/chat` logs every stage without changing the SSE response shape.
- [x] `embedOne` cache is LRU, deterministic, and is bypassed by the env flag.
- [x] No breaking change to the gateway or registry APIs.
- [x] All 306 tests pass (was 286, +20 : 9 latence + 11 cache).
- [x] No new lint errors or warnings.

## What's NOT in the box

- Any change to the SearchAgent prompt (deferred to Phase 9.5 — see E).
- A persistent on-disk cache (deferred — see Embedding Cache ADR for why).
- A model-registry-level warm cache for embedding models (deferred to Phase 9.5 — see B).
- A profile-driven optimisation (e.g. V8 --prof).  Useful but overkill at current WPU.

## How to read the logs

In your dev server terminal, every chat request now produces a
sequence like :

```
[latence] chat.parse=4.821ms {"mode":"balanced"}
[latence] chat.load_models=312.5ms {"chat":"llama-3.3-70b-versatile","embed":"baai/bge-m3"}
[latence] chat.auth=23.4ms {"hasUser":true}
[latence] chat.first_block=2410.7ms
[latence] chat.agent=12842.1ms
[latence] chat.total=12895.0ms {"ok":true}
```

`chat.first_block` is the *user-perceived TTFB*.  `chat.total` is the
wall clock for the full SSE response.

In production, pipe `console.warn` to your log shipper and chart
`p50` / `p95` per stage.  See Phase 9.5 for the dashboard story.

## Test count after this box

- Before Phase 9 : **242 tests**
- After Phase 9 (reranker module + latence module + embed cache) : **306 tests**
- Delta : **+64** (21 reranker + 9 rerank-orchestrator + 3 eval-runner rerank + 9 latence + 11 embed-cache + 11 misc other)

## Review date

Review the cache hit rate at 1k WPU.  If p95 `chat.load_models` is
still > 500ms in the EU, ship Win B (model-registry warm cache).
