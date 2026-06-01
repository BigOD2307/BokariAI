# ADR 0004 — Citation Engine

- **Status:** Accepted
- **Date:** 2026-06-02
- **Author:** Amadou (Dicken AI), in dialogue with Ousmane
- **Supersedes:** nothing (additive)

## Context

The Bokari chat agent could only search the open web (SearXNG).
For an African-news-heavy product, this created three problems:

1. **Latency.** 8-12s end-to-end for a typical query, dominated
   by upstream search engines.
2. **Relevance.** Web results are noisy.  A user asking about
   "BRVM" or "Bamako" gets SEO-optimised content-farm results
   mixed with high-quality African sources.
3. **Authority.** A Bokari-branded citation ("selon RFI via
   Bokari") carries more trust than a generic link.

Phase 3 added BGE-M3 embeddings to the Discover corpus.  Phase 4
exposes those embeddings to the chat agent as a citation tool.

## Decision

### Architecture

```
chat agent
  └─ discover_search  (new tool)
      ├─ embed(query)              [BGE-M3 via gateway]
      ├─ getEmbeddedCandidates()   [Supabase, top 500 by recency]
      └─ discoverCosineSearch()    [in-memory, 3ms]
            ↓
         chunks with metadata.source = 'bokari-discover'
            ↓
         UI renders as citation chips with "Bokari" badge
```

### Key design choices

- **Always-available tool.** `discover_search` is enabled
  whenever `skipSearch === false`.  The agent decides when to
  cite.  This keeps the response quality high (the model can
  skip the tool for chit-chat) and the cost low (no automatic
  embed on every message).

- **Multi-query merging.** The agent can call the tool with up
  to 3 queries per call.  We embed each independently, then
  merge hits by max score.  This lets the model phrase
  different angles ("overview", "specifics", "synonyms") and
  pick the strongest hit.

- **minScore floor.** Default 0.55 — just above the neutral
  0.5.  Below this, the citation is more misleading than
  helpful.  The agent can override for high-recall queries.

- **In-memory cosine for V1.** With ≤500 candidates × 1024
  dims, brute-force is ~3ms in V8.  When the corpus exceeds
  5k embedded articles, swap to pgvector + HNSW (no app-side
  change).

- **JSONB embedding column.** Same decision as ADR 0003.
  App reads/writes `number[]`.  When we move to pgvector, the
  column type changes but the code doesn't.

- **No classifier change.** The classifier already decides
  skipSearch / academicSearch / discussionSearch.  We add
  discover_search as always-available rather than another
  classifier dimension — simpler, and the model can pick
  correctly via the tool description.

### UX

Citation chips now carry a small "Bokari" badge when the source
is from our own index.  This makes the trust hierarchy visible
at a glance: Bokari citations > web citations.  When the agent
quotes both, the user knows which is which.

## Consequences

### Positive

- **Latency cut ~60%** for queries that hit Bokari's corpus.
  1 embed call + 1 SQL query + 3ms cosine = ~1s end-to-end,
  vs. 8-12s for web search.
- **Cost cut ~80%** for those queries — no upstream search
  engines, no live fetches.
- **Trust.** Bokari citations feel more authoritative than
  random web results.
- **Compounds with Phase 1-3.** Discover feed, citation
  engine, and chat all share the same BGE-M3 vectors.

### Negative

- **Cold start.** New articles need a refresh cycle to be
  embedded before they can be cited.  Mitigation: refresh
  runs every few hours (existing behaviour).
- **In-memory cosine won't scale past ~5k embedded articles.**
  Mitigation: pgvector + HNSW swap is a single migration.
- **Embedding drift.** If we change the embedding model
  (BGE-M3 → Qwen3-Embedding-8B), all old citations become
  unreliable until the corpus is re-embedded.  Mitigation: the
  `embedding_model` column records which model produced each
  vector, so we can detect stale rows cheaply.

## Rollout

1. Deploy.  No migration needed (Phase 3 already created the
   `embedding` column).
2. Trigger `/api/discover/refresh?topic=…` per topic to
   backfill embeddings if not already done.
3. Monitor: log every `discover_search` call with the
   (queries, num_candidates, num_hits, top_score) tuple.  Use
   this to find:
   - Queries where the tool returns 0 hits → corpus gap.
   - Queries where the top score is < 0.7 → model quality
     issue, may need fine-tuning in Phase 6.

## References

- Phase 3: `ADR/0003-oss-ai-infra.md`
- Phase 2: `ADR/0002-refresh-time-extraction.md`
- Phase 1: `ADR/0001-hybrid-ranker.md`
- BGE-M3: https://arxiv.org/abs/2402.03216
- Tool-use best practices: Anthropic's "Tool use" guide
