# Phase 7 — Cosine Weight Sweep + Precomputed CI Gate

**Status:** Shipped (commit pending)
**Date:** 2026-06-02
**Owner:** Amadou (Backend + AI/ML) — Dicken AI

---

## What we built

Two deliverables in this phase:

1. **`cosineWeight` is now a knob.**  The ranker exposes
   `RankOptions.cosineWeight` (default 0.3) so we can A/B test the
   cosine blend's strength on the eval fixture.  The default
   behavior is unchanged.
2. **CI now uses precomputed BGE-M3 vectors** — closes the gap
   from Phase 6 where the CI gate only caught BM25 regressions.
   The hybrid gate now runs in CI without any OpenRouter call,
   via `docs/eval/query-embeddings.json` (cached) and
   `src/lib/eval/fixture-embedded.ts` (already cached).

### New files

| File | Role |
| --- | --- |
| `scripts/precompute-query-embeddings.ts` | Embeds the 34 queries with BGE-M3, writes `docs/eval/query-embeddings.json` |
| `scripts/sweep-cosine-weight.ts` | Runs the eval at multiple weights, writes a comparison report |
| `docs/eval/query-embeddings.json` | BGE-M3 vectors for all 34 queries (1024-dim each) |
| `docs/eval/2026-06-02-sweep.md` | Saved sweep report |

### Modified files

| File | Change |
| --- | --- |
| `src/lib/discover/ranker.ts` | `cosineWeight` parameter (clamped to [0, 1]); formula now `(1 - w + w * cos01)` |
| `src/lib/discover/types.ts` | `RankOptions.cosineWeight` field |
| `src/lib/eval/runner.ts` | `RunEvalOptions.cosineWeight`; report now includes `cosineWeight` |
| `scripts/run-eval.ts` | `--precomputed` mode; `--cosine-weight` flag |
| `scripts/check-retrieval.ts` | `--precomputed` mode; `--cosine-weight` flag; uses full hybrid signal in CI |
| `.github/workflows/retrieval-regression.yml` | CI now uses `--precomputed` (not `--offline`) |
| `package.json` | New scripts: `eval:precomputed`, `eval:precompute`, `eval:sweep` |

---

## Cosine weight sweep

Ran the eval at weights 0.0 → 1.0 against the 34-query, 53-article
multilingual fixture.  Full report at
[`docs/eval/2026-06-02-sweep.md`](../eval/2026-06-02-sweep.md).

| Weight | NDCG@10 | MRR | Hit@10 | Δ vs BM25 (NDCG) |
| --- | --- | --- | --- | --- |
| 0.00 | 0.889 | 0.887 | 0.971 | +0.000 |
| 0.10 | 0.889 | 0.887 | 0.971 | +0.000 |
| 0.20 | 0.892 | 0.892 | 0.971 | **+0.004** |
| **0.30 (current default)** | **0.892** | **0.892** | 0.971 | **+0.004** |
| 0.50 | 0.892 | 0.892 | 0.971 | +0.004 |
| 0.70 | 0.892 | 0.892 | 0.971 | +0.004 |
| 1.00 | 0.892 | 0.892 | 0.971 | +0.004 |

### Interpretation

- **Weight 0.0–0.1**:  No change from pure BM25.  The cosine
  factor `(1 - w + w * cos01)` is too close to 1.0 across all
  candidates for it to matter.
- **Weight 0.2–1.0**:  All identical at NDCG@10 = 0.892.
  Once `w` is high enough for cosine to flip a tied BM25 ranking
  (the adversarial cases like "African AI startup funding"),
  going higher doesn't help — the BM25 ranking already orders
  everything else correctly.

### Decision

**Keep the default at 0.3** — it's a safe middle-ground that
captures the +0.004 hybrid gain without putting the lexical
backbone at risk.  Going higher doesn't help on this fixture
but could hurt on a real corpus where BM25 ties happen more
often.  Re-evaluate when the corpus grows to 1000+ articles
or when we add human-rated relevance labels (Phase 8).

---

## Precomputed CI gate

The Phase 6 CI gate ran in `--offline` mode, which used unit
vectors and thus produced identical BM25 and hybrid numbers —
making it a *BM25* gate in disguise.

Phase 7 closes that gap with `--precomputed` mode:

- **BGE-M3 vectors for the 53 fixture articles** are already
  in the repo at `src/lib/eval/fixture-embedded.ts`.
- **BGE-M3 vectors for the 34 queries** are now in the repo at
  `docs/eval/query-embeddings.json` (3.6s to generate, 1024-dim
  each, 34 × 1024 × 8 bytes ≈ 280 KB on disk).
- The CI workflow runs
  `npx tsx scripts/check-retrieval.ts --precomputed`.
- This produces the **real** hybrid NDCG@10 = 0.892, MRR =
  0.892, hit-rate@10 = 0.971 — and any drop in any of those
  metrics fails the build.

No API calls.  No secrets.  ~165ms per CI run.

### Maintenance

When the eval fixture changes (new articles, new queries):

```bash
# 1. Edit src/lib/eval/fixture.ts and/or src/lib/eval/dataset.ts.
# 2. Re-embed the articles.
npx tsx scripts/embed-fixture.ts
# 3. Re-embed the queries.
npx tsx scripts/precompute-query-embeddings.ts
# 4. Update the baseline (numbers will have changed).
npx tsx scripts/check-retrieval.ts --precomputed --update-baseline
# 5. Commit all four files.
git add src/lib/eval/fixture.ts src/lib/eval/fixture-embedded.ts \
        src/lib/eval/dataset.ts docs/eval/query-embeddings.json \
        docs/eval/baseline.json
git commit -m "chore(eval): add N new articles, refresh baseline"
```

---

## Why this matters for Bokari

Phase 6 made the multilingual claim falsifiable: "Bokari works
in Bambara/Wolof/Hausa/Swahili" is now backed by 0.93-1.0 NDCG
on the multilingual queries.

Phase 7 makes the **regression** claim falsifiable: any future
change to the ranker that drops hybrid NDCG@10 by > 0.02 will
fail CI before it ships.  This is the difference between a
*measurement* and a *guard rail*.

The cosine weight sweep also gives us data for future tuning.
If a Phase 8 feature adds a third signal (e.g. cross-language
BM25 boost), the sweep pattern is established and we can
re-run it to find the new optimum.

---

## Test coverage

| Suite | Tests | Δ |
| --- | --- | --- |
| `tests/discover/ranker.test.ts` | 21 | +3 (cosine weight 0/1/clamp) |
| `tests/eval/metrics.test.ts` | 20 | 0 |
| `tests/eval/dataset.test.ts` | 10 | 0 |
| `tests/eval/runner.test.ts` | 6 | 0 |
| **Total eval** | **36** | 0 |
| **Total project** | **242** | **+3** |

All 242 tests green.  Tsc clean.  Lint clean on all touched files.

---

## Related docs

- `ADR/0007-cosine-weight-knob-and-precomputed-ci.md` — decision record
- `docs/eval/2026-06-02-sweep.md` — sweep report
- `docs/eval/baseline.json` — CI baseline (now precomputed, hybrid)
- `docs/eval/query-embeddings.json` — cached BGE-M3 query vectors
- `docs/architecture/PHASE-6-CI-AND-MULTILINGUAL.md` — prior phase
- `docs/architecture/ADR/0006-multilingual-eval-and-ci-gate.md` — prior ADR
