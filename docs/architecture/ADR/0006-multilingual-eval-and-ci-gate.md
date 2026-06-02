# ADR 0006 — Multilingual Eval Expansion + CI Regression Gate

- **Status:** Accepted
- **Date:** 2026-06-02
- **Deciders:** Amadou (Dicken AI — Backend + AI/ML)
- **Supersedes:** none
- **Related:** ADR 0003 (OSS AI infra), ADR 0005 (eval harness)

## Context

Phase 5 shipped a reproducible eval harness for the citation
engine, but two real questions remained unanswered:

1. **Does BGE-M3 actually add value on Bokari's target use
   case?**  Phase 5 reported Δ=+0.000 between BM25 and hybrid
   on the 23-query fixture — the fixture was too clean.
2. **What happens when an African user types in Bambara, Wolof,
   Hausa, or Swahili?**  We had no queries in those languages.
   BM25 is keyword-based; without cosine, multilingual queries
   would score 0.

We also had no pre-deploy gate: any change to
`src/lib/discover/ranker.ts` or `src/lib/ai/gateway.ts` could
ship a regression and we'd only notice in production.

## Decision

Two changes in this phase:

### 1. Expand the eval fixture with adversarial + multilingual content

- **20 new articles** in the fixture (33 → 53):
  - 4 in Bokari's 4 target languages (Bambara, Wolof, Hausa,
    Swahili).
  - 4 cross-language distractors (same language, wrong topic).
  - 12 French/English adversarial distractors (same keywords,
    different intent — e.g. "Sahel food security" as a
    distractor for "Sahel security crisis").
- **11 new queries** (23 → 34):
  - 8 native-language queries (Bambara, Wolof, Hausa, Swahili).
  - 3 cross-language pairs (EN→FR, FR→EN, EN→mixed).

### 2. Add a CI regression gate

- **`scripts/check-retrieval.ts`** runs the eval in offline
  mode, compares to `docs/eval/baseline.json`, exits 0/1
  based on whether any of NDCG@10, MRR, hit-rate@10 dropped
  by more than 0.02.
- **`.github/workflows/retrieval-regression.yml`** runs the
  gate on every PR that touches `src/lib/discover/**`,
  `src/lib/eval/**`, `src/lib/ai/**`, or any eval script.
- **`docs/eval/baseline.json`** stores the current numbers
  (offline mode, 0.889 NDCG@10 / 0.887 MRR / 0.971 hit-rate).
- **`package.json`** exposes `eval`, `eval:offline`,
  `eval:check`, `eval:update-baseline`, `eval:embed-fixture`.

### Why offline mode in CI

Live eval needs `OPENROUTER_API_KEY` and calls BGE-M3 on
every PR.  Costs ~$0.50 per run and 5-10s of latency.  For
pre-deploy, that's a lot to pay for "did anything break?".
We accept the tradeoff: CI gates against *BM25* regressions
(deterministic, fast, free), humans gate against *hybrid*
regressions (live eval on demand).

If we wanted to gate against hybrid in CI, we'd:
- Move embeddings into a precomputed fixture (Phase 7).
- Add the fixture to the repo (it's already there as
  `fixture-embedded.ts`).
- Have CI read the precomputed embeddings and compute
  cosine locally (no API call).

We're 60% of the way there.  Phase 7 will close the gap.

## Consequences

Positive:

- **Bokari's multilingual claim is now backed by numbers.**
  Bambara / Wolof / Hausa / Swahili queries score 0.93-1.0 on
  Hybrid.  We can put this in the marketing deck.
- **Pre-deploy gate exists.**  Any future change to
  `src/lib/discover/ranker.ts` is protected.
- **Eval is now harder to game.**  The 20 new adversarial
  articles force the cosine factor to do real work.

Negative:

- **Offline CI gate is a half-measure.**  It catches BM25
  regressions but not hybrid regressions.  We accept this
  for V1; Phase 7 will close the gap.
- **Derived grader misses cross-language matches.**  A French
  query for "intelligence artificielle" against an English
  article titled "African AI startup" gets rel=0, even though
  BGE-M3 would find it.  This caps NDCG@10 at 0.89 in our
  current eval.  We need human-rated labels for the 11
  multilingual queries to fix this.
- **Eval size grew from 33 to 53 articles.**  Embedding time
  went from 2s to 4.4s.  Fine for now, will need to be
  cached / precomputed for CI at scale.

## Alternatives considered

- **Run live eval in CI.**  Rejected for V1: cost ($0.50/PR
  × ~50 PRs/month = $25/month), latency (5-10s), secret
  management (need to add `OPENROUTER_API_KEY` to GitHub
  Actions secrets).  Phase 7 will move embeddings into
  the repo and skip the network.
- **Skip the CI gate, rely on human review.**  Rejected: the
  whole point of an eval is to *automate* the regression
  check.  Humans forget; CI doesn't.
- **Higher cosine weight (0.5).**  Rejected for V1: would
  improve the multilingual numbers but might hurt
  French/English queries where BM25 is exact.  Need
  human-rated labels to make the call safely.  Phase 7.

## Implementation

Files added/changed in this phase:

- `src/lib/eval/fixture.ts` (+20 articles)
- `src/lib/eval/dataset.ts` (+11 queries)
- `src/lib/eval/fixture-embedded.ts` (regenerated, 53 vectors)
- `scripts/check-retrieval.ts` (new)
- `.github/workflows/retrieval-regression.yml` (new)
- `docs/eval/baseline.json` (new)
- `docs/eval/2026-06-02-phase-6.md` (full report)
- `docs/architecture/PHASE-6-CI-AND-MULTILINGUAL.md` (this
  phase doc)
- `package.json` (eval scripts)

Tests:

- 36/36 in `tests/eval/` (unchanged count, all green).
- The runner's tests use `AFRICAN_EVAL_QUERIES.length` and
  don't hardcode the count, so they're auto-validating.

Run:

```bash
npm run eval                  # live eval (needs OPENROUTER_API_KEY)
npm run eval:offline          # offline eval (free)
npm run eval:check            # CI gate
npm run eval:update-baseline  # update baseline
npm run eval:embed-fixture    # regenerate fixture embeddings
```

## Review

Re-evaluate when:
- We have 50+ human-rated queries (multilingual included).
- The cosine weight or ranker formula changes materially.
- A user reports "Bokari gave me the wrong answer in
  Bambara/Wolof/Hausa/Swahili."
- We add a new embedding model to the gateway.
- BGE-M3 itself gets a major version bump.
