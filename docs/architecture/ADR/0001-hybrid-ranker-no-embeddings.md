# ADR 0001 — Hybrid Ranker Without Embeddings

> **Date:** 2026-06-01
> **Status:** Accepted
> **Deciders:** Amadou (backend), Salif (CMO), Cheick (CTO)
> **Related:** [Phase 1 Hybrid Retrieval](../PHASE-1-HYBRID-RETRIEVAL.md)

## Context

Phase 0 audited the Discover pipeline and found three hard problems:

1. The old pipeline was a parallel search → dedup → **`.sort(() => Math.random() - 0.5)`**.
   Every user got a different order on every refresh.
2. No ranking signal: an article from a low-quality source could outrank one from RFI.
3. No freshness, no diversity, no language awareness.

The "obvious" 2026 answer is "throw embeddings at it" — embed all articles, do a cosine-similarity search, combine with BM25 via RRF.  But we have to ask: is that the right move right now, or is it premature?

## Decision

We will **NOT** add embeddings to the Discover pipeline in Phase 1.

Instead, the ranker will combine:
- BM25 (lexical) over the user's query + every expanded variant, take the max
- Freshness decay (multiplicative, half-life 3 days)
- African-source boost (multiplicative ×1.5)
- Quality signal (additive, ±25%)
- Domain diversity cap (greedy post-rank)

## Rationale

1. **No embedding infra.** We don't have an `embeddings` table in Supabase, no
   pgvector, no batch embedding job, no embedding for the corpus we have
   today.  Standing that up is its own phase (Phase 3).

2. **BM25 gets us 80%.**  At our volume (50-100 articles per topic per refresh),
   the difference between "great BM25" and "great BM25 + cosine" is small for
   the user.  Cosine helps when the user searches for a synonym that doesn't
   appear in the article — but our `expandQuery` already produces synonym
   variants, which is cheaper than embedding every article.

3. **Embeddings cost money and time.** text-embedding-3-small at $0.02/M tokens
   × ~50k articles × ~500 tokens = $0.50 per refresh × 3 refreshes/day = $45/mo
   per region.  We're not there yet.

4. **Deterministic > magical.**  A user can complain "this article shouldn't
   be #1" and we can point to the exact `scoreBreakdown` showing bm25=2.3,
   freshness=0.5, etc.  An embedding-based system is a black box.  For a
   feed of "news for Africa", debuggability matters.

5. **The most expensive signal — freshness — is independent of embeddings.**
   A 7-day-old article with a perfect BM25 should still not beat a 1-day-old
   article with a slightly lower BM25.  Multiplicative decay enforces that
   regardless of how we score relevance.

6. **We can add embeddings later without breaking anything.** The ranker
   takes a `ScoreBreakdown` shape; we can add `cosine: number` to it
   without changing the API.  Migration cost: ~1 day of work.

## Alternatives considered

### A. Cosine similarity over title-only embeddings
- **Pro:** Cheap.  ~50 tokens per article.  < $0.05 per refresh.
- **Con:** Need to wire up an embedding service (OpenAI or local), pgvector,
  an `embeddings` table, a nightly batch job.  That's a phase, not a sub-task.
- **Decision:** defer.

### B. Hybrid: BM25 + cosine, fused via RRF
- **Pro:** State of the art.  Used by Weaviate, Vespa, Elasticsearch 8.
- **Con:** Same infra cost as A, plus the RRF math to tune.
- **Decision:** defer.

### C. LLM-based re-ranking
- **Pro:** Could give a big relevance boost.
- **Con:** 1-2 s added latency per query, $5-50/mo at our volume, hard to
  debug, and we'd still want BM25 underneath.
- **Decision:** defer (Phase 5+).

### D. Do nothing, keep the random shuffle
- **Pro:** Free.  5 lines of code.
- **Con:** Garbage UX, no ranking, no explanation for results.
- **Decision:** rejected.  This is the bug we're fixing.

## Consequences

### Positive
- We ship today.  No waiting for infra work.
- The ranker is fast (sub-ms), deterministic, and debuggable.
- Each signal can be tuned independently: change half-life, change diversity
  cap, change African boost — all 1-line changes with tests.
- When embeddings land, we drop them in via the same interface.

### Negative
- Synonym-heavy queries still suffer (e.g. "ML" vs "machine learning").  Our
  `expandQuery` covers common cases but not all of them.
- The corpus must contain the query terms for an article to rank.  Pure
  semantic search would help with that.

### Neutral
- The `scoreBreakdown` shape is part of the public API now.  If we add
  embeddings later, we'll add `cosine: number` to it; no breaking change.

## Review

We will revisit this decision when any of the following becomes true:
- Bokari's content corpus exceeds 10,000 articles (then embedding every
  article is cheap and the relevance gap matters)
- We have a self-hosted embedding service (e.g. via Ollama + Nomic)
- The user-base complains that the Discover feed "doesn't understand me"
  in measurable numbers (NDCG@10 below 0.6 on our eval set)
