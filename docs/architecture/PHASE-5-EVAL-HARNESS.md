# Phase 5 — Eval Harness

**Status:** Shipped (commit pending)
**Date:** 2026-06-02
**Owner:** Amadou (Backend + AI/ML) — Dicken AI

---

## What we built

A reproducible evaluation pipeline for Bokari's citation engine. The harness
runs 23 hand-curated African queries against a 33-article fixture, compares
BM25-only retrieval to hybrid (BM25 + BGE-M3 cosine), and reports
NDCG@10, MRR, and hit-rate@10.

### Components

| File | Role |
| --- | --- |
| `src/lib/eval/metrics.ts` | Pure IR metrics: DCG, IDCG, NDCG, MRR, hit-rate, aggregate |
| `src/lib/eval/dataset.ts` | 23 African queries + `deriveRelevance()` token-overlap grader |
| `src/lib/eval/fixture.ts` | 33-article synthetic corpus (hand-written, reproducible) |
| `src/lib/eval/fixture-embedded.ts` | Same corpus with BGE-M3 embeddings baked in (auto-generated) |
| `src/lib/eval/runner.ts` | `runEval(corpus, queries, embedFn)` — BM25 vs hybrid comparison |
| `scripts/run-eval.ts` | CLI runner with `--offline` and `--out=` flags |
| `scripts/embed-fixture.ts` | Computes embeddings for the fixture via the gateway |
| `docs/eval/2026-06-02.md` | First saved report (this run) |

### Test coverage

| Suite | Tests | What's tested |
| --- | --- | --- |
| `tests/eval/metrics.test.ts` | 20 | DCG, IDCG, NDCG, MRR, hit-rate, edge cases |
| `tests/eval/dataset.test.ts` | 10 | `deriveRelevance()` across topic, mustMatch, forbidden, body-only |

**Total:** 30 tests in the eval package, all green.

---

## How to run

```bash
# Offline — uses unit vectors, ~200ms, no API calls
npx tsx scripts/run-eval.ts --offline

# Live — embeds queries with BGE-M3, ~5s for 23 queries
npx tsx scripts/run-eval.ts

# Save to a report file
npx tsx scripts/run-eval.ts --out=docs/eval/2026-06-02.md
```

When you add new articles to `fixture.ts`, re-run
`scripts/embed-fixture.ts` to regenerate `fixture-embedded.ts`, then
commit the result. The script is idempotent (overwrites).

---

## Results (2026-06-02, K=10)

```
NDCG@10      BM25: 0.924     Hybrid: 0.924     Δ: +0.000
MRR          BM25: 0.928     Hybrid: 0.928     Δ: +0.000
Hit rate@10  BM25: 1.000     Hybrid: 1.000     Δ: +0.000
```

The full per-query table is in
[`docs/eval/2026-06-02.md`](../eval/2026-06-02.md).

### Key observations

- **Hit rate@10 = 1.0** — the engine returns at least one relevant
  article in the top 10 for every query.  We never miss completely.
- **NDCG@10 = 0.924** — when we get the answer, we usually rank it
  near the top.  The few losses (0.498, 0.631) come from queries with
  multiple relevant articles where the wrong one ranks first
  lexically.
- **Hybrid does not beat BM25 on this fixture.**  BM25 is already so
  good at matching African news tokens (English, French, names) that
  BGE-M3's semantic signal doesn't reorder anything.  The cosine
  factor of 0.3 in our ranker is a tie-breaker, not a re-ranker.

---

## Why hybrid doesn't help (yet)

The hybrid formula in `src/lib/discover/ranker.ts:96` is

```
final = BM25 × freshness × africanBoost × (0.5+0.5×quality) × (0.7+0.3×cosine01)
```

For cosine to *flip* the order of two articles, their BM25 scores
must be close AND their cosines must differ.  On our fixture, the
BM25 scores are spread (1.0 vs 0.1), so the cosine factor can't
cross the gap.  Three ways to make this signal visible:

1. **Adversarial fixture expansion** — add articles with overlapping
   tokens but different topics (e.g. "Sahel : la nouvelle saison
   touristique" as a distractor for "Sahel security crisis").  The
   `fixture-029` and `fixture-030` additions in this phase are the
   start; we need ~10 more.
2. **Cross-language queries** — most of our current queries are
   English/French; BGE-M3 is strongest on multilingual.  Add Bambara,
   Wolof, Hausa, Swahili queries with English-matching articles.
3. **Tighter cosine weight** — bump the cosine factor from 0.3 to
   0.5 in `ranker.ts` and re-run.  Tradeoff: hurt lexical-only
   queries.

We'll do (1) and (2) in Phase 6 as we build the cross-language
citation demo.  (3) is a product decision, not a data decision.

---

## Known limitations

1. **Derived relevance is noisy.**  Token overlap is a proxy for
   human judgment.  Real eval needs human-rated relevance on
   ~100 African queries.  Deferred to Phase 6.
2. **Small corpus (33 articles).**  Real corpora are 1000+ articles;
   the relative BM25-vs-hybrid comparison should hold but absolute
   numbers will drop as the corpus grows.
3. **No live mode yet.**  The eval only runs against the fixture.
   Phase 6 will add a "live" mode that pulls the most recent 500
   embedded articles from Supabase and grades them against the
   same query set.
4. **No inter-rater agreement.**  The grader is deterministic, so we
   can't measure label noise.  Won't fix until we have human labels.

---

## What this enables (Phase 6+)

- **A/B testing retrieval changes.**  Bump cosine weight, add a
  BM25 alternative, swap in a different embedding model — every
  change shows up as a delta in the report.
- **Cross-language demo.**  BGE-M3 understands Bambara / Wolof /
  Hausa / Swahili.  Once we add multilingual queries to the
  dataset, the eval will measure whether our cross-language UX
  actually works.
- **Pre-deploy gate.**  In CI, run the eval on every PR that
  touches `src/lib/discover/` or `src/lib/ai/`.  Reject any
  change that drops NDCG@10 by > 0.02.

---

## Related docs

- `ADR/0005-eval-harness.md` — decision record
- `docs/eval/2026-06-02.md` — first saved report
- `docs/architecture/PHASE-3-OSS-AI-INFRA.md` — gateway used by the runner
- `docs/architecture/PHASE-4-CITATION-ENGINE.md` — pipeline the eval grades
