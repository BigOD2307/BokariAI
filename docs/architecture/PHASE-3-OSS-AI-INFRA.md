# Phase 3 — Open-Source AI Infrastructure

> BGE-M3 embeddings on the Discover pipeline + a single AI gateway for
> every model call in Bokari.  OSS-first, Groq primary / OpenRouter
> fallback, ~$0 of vendor lock-in.

## Why

Bokari is a product for African job seekers.  The default AI stack
must be:

1. **Open-source** — no vendor lock-in for the global-south founders
   and users we serve.
2. **Multilingual** — Bambara, Wolof, Hausa, Swahili, French, English
   out of the box.
3. **Cheap** — Phase 4 (the citation engine) will fire 10-100× more
   embedding calls than Phase 2.  We need a provider that charges
   cents, not dollars.
4. **Resilient** — if the primary provider is down (rate-limited,
   regional outage, credit card expired), Bokari must still answer.
5. **Centralised** — every model call goes through one module so we
   can swap models without grep-and-replace across the codebase.

## What ships in Phase 3

### 1. OpenRouter provider

`src/lib/models/providers/openrouter/`
- `openrouterLLM.ts` — extends OpenAILLM, baseURL = openrouter.ai
- `openrouterEmbedding.ts` — BGE-M3 et al.
- `index.ts` — provider registration with curated defaults

Curated defaults:
- **Chat**: Llama 3.3 70B, Llama 3.1 8B, Qwen3 32B, Gemma 3 27B,
  Mistral Nemo.
- **Embedding**: BGE-M3 (MIT, 1024d, 100+ langs), Qwen3-Embedding-8B
  (Apache 2.0, 4096d), multilingual-e5-large (MIT, 1024d).

All under $0.0000002/1M tokens on OpenRouter.  Practically free for
Bokari's traffic.

### 2. AI gateway

`src/lib/ai/`
- `config.ts` — env-var driven defaults: Groq chat, OpenRouter embed.
- `gateway.ts` — single entry point: `embed()`, `embedOne()`,
  `chatWithFallback()`.  Lazy registry init so the file is pure-import
  safe (tests don't trigger the config-file read).

Key invariants:
- **Embeddings batched** at 32 to be polite to OpenRouter.
- **Retries** with exponential backoff on 429 / 5xx (default 2
  retries, 400ms base).
- **Fallback chain** for chat: Groq → OpenRouter.  Both serve the same
  Llama 3.3 70B model, so quality is identical — only the upstream
  changes.
- **Failures are loud** — never swallowed.  The refresh route catches
  embed failures and degrades to BM25-only (cosine=0.5).

### 3. BGE-M3 on Discover

`src/lib/discover/cosine.ts` — pure cosine similarity, edge cases
handled (zero vectors, mismatched lengths, non-finite inputs).

`src/lib/discover/ranker.ts` — new cosine blending:

```
final = bm25 * freshness * africanBoost * (0.5 + 0.5*quality) * (0.7 + 0.3*cosine01)
```

The (0.7 + 0.3*cosine01) floor means cosine can boost an article by
up to 30% but never crush a strong BM25 hit.  When neither side is
embedded, the factor is 0.85 — a tiny uniform discount that
disappears the moment any side has an embedding.

`src/lib/discover/types.ts` — `Article.embedding` and
`ScoreBreakdown.cosine` added.

### 4. Refresh-time embedding

`src/app/api/discover/refresh/route.ts` now:
1. Runs the pipeline → ScoredArticle[]
2. Extracts full content in parallel (Phase 2)
3. **NEW**: embeds `title×2 + content(≤1500 chars)` for every article
   via the gateway
4. Upserts to Supabase with `embedding` + `embedding_model` columns

Embedding failures are non-fatal — we still upsert the row, just
without an embedding.  Re-rank treats it as neutral (cosine=0.5).

### 5. Database migration

`supabase/migrations/20260604_embeddings.sql`:
- `embedding JSONB` — array of floats
- `embedding_model TEXT` — which model produced the vector
- Partial index on `embedding_model` WHERE `embedding IS NOT NULL`
  for cheap "how many articles are embedded?" queries

**Why JSONB, not pgvector?**
- V1 has <100k articles → brute-force cosine is fast enough.
- JSONB is debuggable: `SELECT embedding[0:3] FROM discover_articles`
  in the Supabase dashboard, no extension install.
- We can swap to pgvector + HNSW later with zero app-side changes.

## Live smoke test (2026-06-01)

BGE-M3 via OpenRouter via the gateway, on a 3-title set:

| Pair | Cosine | Topic |
|------|--------|-------|
| Bamako title #1 ↔ Bamako title #2 | **0.88** | same topic |
| Bamako title #1 ↔ Ethereum staking | 0.33 | unrelated |
| Bamako title #2 ↔ Ethereum staking | 0.33 | unrelated |

Confirmed: BGE-M3 distinguishes topics, returns 1024-dim vectors in
~700ms per embed on OpenRouter.

## Migration rollout

1. Apply `supabase/migrations/20260604_embeddings.sql` in the
   Supabase dashboard.
2. The refresh route auto-embeds new articles on the next refresh
   cycle.  Old articles (rows inserted before the migration) have
   `embedding = NULL` and rank with cosine=0.5.
3. To backfill, re-trigger `/api/discover/refresh?topic=…` for each
   topic — the upsert will populate `embedding` on the existing rows.
4. (Optional) Run a backfill script that iterates over NULL embeddings
   in batches of 100 and embeds them.  Will be added if the natural
   refresh backfill is too slow.

## What this unlocks (Phase 4+)

- **Citation engine** — embed user queries, find best-matching
  articles by cosine, cite them.  Already half-built in the ranker.
- **Cross-language search** — embed a French query, find relevant
  English articles (BGE-M3 is multilingual by design).
- **Topic clustering** — `embed(article) → k-means → 7 topics` to
  auto-discover sub-topics within "tech" or "africa".
- **pgvector swap** — when we exceed 100k articles, swap JSONB for
  pgvector + HNSW.  Zero app-side change; only the Supabase migration
  changes.

## Test coverage

180 unit tests, 0 flakes.  New in Phase 3:
- `tests/discover/cosine.test.ts` — 14 cases (edge cases, math, mapping)
- `tests/discover/ranker.test.ts` — 7 new cosine cases on top of the
  11 existing
- `tests/ai/config.test.ts` — 3 cases (env overrides, defaults, junk input)
- `tests/ai/embed-helpers.test.ts` — 5 cases (title repetition, truncation)

## What we deliberately did NOT do

- **No pgvector** yet — see above.  Will add in Phase 5 if needed.
- **No query-time embedding on Discover feed** — the feed is
  topic-driven, not query-driven, so cosine would be a constant
  neutral.  When Phase 4 adds a real user query field, we wire
  query embedding then.
- **No model fine-tuning** — BGE-M3 is already strong on African
  languages out of the box (MTEB benchmark).  Fine-tuning is a Phase 6
  lever if we collect enough feedback data.
