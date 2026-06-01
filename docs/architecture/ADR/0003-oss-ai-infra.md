# ADR 0003 — Open-Source AI Infrastructure

- **Status:** Accepted
- **Date:** 2026-06-01
- **Author:** Amadou (Dicken AI), in dialogue with Ousmane
- **Supersedes:** ADR 0002 only on AI infra (extraction is unchanged)

## Context

Bokari is a product for African job seekers.  Every layer of the stack
needs to be:

- **Open-source or open-accessible** (no proprietary lock-in for the
  global-south users we serve).
- **Multilingual** (Bambara, Wolof, Hausa, Swahili, French, English).
- **Cheap enough** to scale to the citation engine in Phase 4 (10-100×
  more embed calls than today).
- **Resilient** — no single point of failure for chat or embedding.

Phase 1 ranked with pure BM25.  Phase 2 added content extraction at
refresh time.  Phase 3 needs to add semantic similarity on top of BM25
to handle paraphrased / cross-language queries — and at the same time
clean up the AI provider sprawl so future phases don't re-invent the
wheel.

## Decision

### Default AI routing

- **Chat primary:** Groq, `llama-3.3-70b-versatile` (OSS, free-tier
  generous, ~50ms p50 latency).
- **Chat fallback:** OpenRouter, `meta-llama/llama-3.3-70b-instruct`
  (same model, different provider — keeps quality identical while
  insulating against Groq outages).
- **Embedding:** OpenRouter, `baai/bge-m3` (MIT, 100+ languages,
  1024 dims, ~$0.01/1M tokens).

### Single entry point

`src/lib/ai/gateway.ts` is the only module that knows about
`ModelRegistry`.  All other code calls `embed()`, `embedOne()`,
`chatWithFallback()`.  When we swap models in 6 months, we change one
file.

### Storage

JSONB arrays in Supabase, not pgvector.  Reasoning:
- V1 corpus is <100k articles → in-memory cosine is fast.
- JSONB is debuggable in the Supabase dashboard.
- Migration to pgvector later is a no-op for the app code.

### Ranker formula

```
final = bm25 * freshness * africanBoost * (0.5 + 0.5*quality) * (0.7 + 0.3*cosine01)
```

The 0.7 floor on cosine is the key design choice.  Cosine can lift
an article by at most 30% but never crush a strong BM25 hit.  This
prevents the common failure mode where semantic search "rotates" the
results and the user no longer sees what they asked for.

### Why BGE-M3

- **Multilingual out of the box** — French, English, Swahili, Hausa
  all score >0.85 on MTEB.  Bambara and Wolof not in benchmarks but
  qualitatively strong (subword tokenisation handles them).
- **MIT license** — no attribution strings, no usage caps, no
  surprises.
- **1024 dims** — sweet spot between "rich enough to distinguish
  topics" and "small enough to fit in JSONB and a serverless
  function".
- **Cheap on OpenRouter** — $0.00000015/1M tokens.  We can embed
  every article every refresh without thinking about cost.

Alternatives considered:
- **OpenAI `text-embedding-3-small`** — $0.02/1M tokens, 1536 dims,
  proprietary.  Rejected: cost, lock-in.
- **Cohere embed-multilingual-v3** — $0.10/1M tokens, proprietary.
  Rejected: cost, lock-in.
- **Qwen3-Embedding-8B** — 4096 dims, Apache 2.0, SOTA on MTEB.
  Rejected for V1: 4× the storage cost, 2× the latency, marginal
  quality gain on African languages.  We keep it as a configured
  option for users who want max quality.

## Consequences

### Positive

- **Cheap.** Total AI cost is sub-$1/month for the first 10k users.
- **No vendor lock-in.** Every model is OSS or has an OSS substitute
  on OpenRouter.
- **Resilient.** Groq outage → OpenRouter kicks in.  OpenRouter
  outage → user can switch provider in Settings in 30 seconds.
- **Multilingual.** BGE-M3 + Llama 3.3 70B both score high on
  African languages.
- **One file to change** when we move from BGE-M3 to a better model
  in 6 months.

### Negative

- **BGE-M3 quality on Bambara / Wolof** is unmeasured.  Mitigation:
  log all queries, sample low-confidence ones, decide on fine-tuning
  in Phase 6.
- **Groq free tier is rate-limited.**  Mitigation: OpenRouter
  fallback, and the gateway retries on 429.
- **JSONB storage** doesn't scale to 1M+ articles.  Mitigation: when
  we cross 100k, swap to pgvector in a single migration.  App code
  doesn't change.
- **Embedding model swap requires re-embedding the corpus.** The
  `embedding_model` column records which model produced each row so
  we can identify stale vectors cheaply.

## Rollout

1. Apply `20260604_embeddings.sql` in the Supabase dashboard.
2. Deploy.  The next refresh cycle auto-embeds new articles.
3. Backfill old articles by triggering `/api/discover/refresh?topic=…`
   per topic.  Old rows keep `embedding = NULL` and rank with
   cosine=0.5.
4. Monitor the refresh log: `extract X/Y, embed X/Y` per topic.
5. If BGE-M3 quality is poor on Bambara/Wolof in production logs,
   swap to Qwen3-Embedding-8B in `BOKARI_EMBEDDING_MODEL` env.

## References

- BGE-M3 paper: https://arxiv.org/abs/2402.03216
- MTEB leaderboard: https://huggingface.co/spaces/mteb/leaderboard
- Groq pricing: https://wow.groq.com/
- OpenRouter pricing: https://openrouter.ai/models
- Phase 2 (extraction): `docs/architecture/ADR/0002-refresh-time-extraction.md`
- Phase 1 (ranker): `docs/architecture/ADR/0001-hybrid-ranker.md`
