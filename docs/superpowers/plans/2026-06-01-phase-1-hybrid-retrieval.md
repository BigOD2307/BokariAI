# Phase 1 — Hybrid Retrieval for Discover

> **For agentic workers:** This is a self-contained plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current "search → dedup → random shuffle" Discover pipeline with a deterministic, explainable, multi-signal ranker that delivers measurably better articles to African users.

**Architecture:** In-memory hybrid ranker combining BM25 (lexical) + freshness decay + African-context boost + domain diversity cap. Zero new dependencies. No embeddings yet (Phase 3). Deterministic and testable.

**Tech Stack:** TypeScript, Vitest, Supabase Postgres, existing search engines (DDG + Brave + SearXNG).

---

## Problem statement

`/api/discover` currently does:
1. Run 3-4 pre-defined queries per topic in parallel
2. Flatten, dedup by URL
3. **`.sort(() => Math.random() - 0.5)` — random shuffle** (`src/app/api/discover/route.ts:129`)
4. Cache the result for 8h

This is broken because:
- **No ranking**: best article for "AI startups Senegal" might be position 17
- **No freshness**: 2-week-old article ranks same as today's
- **No diversity**: one source can fill 30% of the feed
- **No query understanding**: "comment investir en BRVM" treated same as "actualités BRVM"
- **Random results**: same user, two refreshes, different order

## Goals (what success looks like)

1. **Deterministic ordering**: same input → same output, no random
2. **Freshness wins**: today's article beats 7-day-old article when both match
3. **Diverse sources**: no single domain > 2 results in top 10
4. **African-first**: African sources get a multiplicative boost when the query is African-context
5. **Explainable**: each ranked article has a `scoreBreakdown` so we can debug
6. **Fast**: < 50ms for the ranking step (it's pure math, no I/O)
7. **Tested**: each component has its own test file, full coverage of edge cases

## Non-goals (deferred)

- Embedding-based cosine similarity (Phase 3 — needs embedding infra)
- Cross-encoder re-ranking (no ML model in stack)
- LLM-based query expansion (cost)
- Real-time content extraction at refresh time (cost — done at query time)

## Architecture

```
Discover query (topic=africa, mode=normal)
    │
    ▼
┌────────────────────────┐
│  1. Query Understanding │  classifyQuery + expandQuery
│     src/lib/discover/   │  → intent + 3-4 query variants
│        query.ts         │
└──────────┬─────────────┘
           │ queries[]
           ▼
┌────────────────────────┐
│  2. Parallel search     │  DDG + DDG News + Brave + SearXNG
│     (existing)          │  → ~50-100 raw results
└──────────┬─────────────┘
           │ rawResults[]
           ▼
┌────────────────────────┐
│  3. Language detection  │  fr / en / bm / wo / ha / sw
│     src/lib/discover/   │
│        language.ts      │
└──────────┬─────────────┘
           │ rawResults[] w/ language
           ▼
┌────────────────────────┐
│  4. BM25 scoring        │  per query variant, take max
│     src/lib/discover/   │
│        bm25.ts          │
└──────────┬─────────────┘
           │ scoredResults
           ▼
┌────────────────────────┐
│  5. Freshness boost     │  exp decay, half-life = 3 days
│     src/lib/discover/   │
│        freshness.ts     │
└──────────┬─────────────┘
           │
           ▼
┌────────────────────────┐
│  6. African-context     │  multiplicative ×1.5 if African
│     boost               │  source AND African query
└──────────┬─────────────┘
           │
           ▼
┌────────────────────────┐
│  7. Domain diversity    │  cap 2 per domain in top N
│     src/lib/discover/   │  uses greedy re-ranking
│        diversity.ts     │
└──────────┬─────────────┘
           │
           ▼
┌────────────────────────┐
│  8. Final ranking +     │  sort by combined score
│     score breakdown     │  return Article[] with
└──────────┬─────────────┘  scoreBreakdown
           │
           ▼
       to UI / cache
```

## File structure

```
src/lib/discover/
├── index.ts            # public API: runDiscoverPipeline
├── types.ts            # Article, ScoredArticle, QueryIntent, RankOptions
├── domainLists.ts      # AFRICAN_DOMAINS, BLOCKED_DOMAINS
├── language.ts         # detectLanguage (light heuristic)
├── query.ts            # classifyQuery + expandQuery
├── bm25.ts             # BM25 scorer
├── freshness.ts        # half-life decay
├── diversity.ts        # domain cap
├── ranker.ts           # hybrid combiner (BM25 + freshness + boost)
└── pipeline.ts         # orchestrator

src/lib/agents/search/
└── contentScoring.ts   # NEW: computes quality_score during refresh

src/app/api/discover/
├── route.ts            # MODIFIED: use new pipeline
└── refresh/route.ts    # MODIFIED: store language + published_at

supabase/migrations/
└── 20260602_discover_metadata.sql  # NEW: add columns

tests/discover/
├── query.test.ts
├── language.test.ts
├── bm25.test.ts
├── freshness.test.ts
├── diversity.test.ts
├── ranker.test.ts
└── pipeline.test.ts
```

## Data model changes

New columns on `discover_articles`:

```sql
ALTER TABLE public.discover_articles
  ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'fr',
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS author TEXT,
  ADD COLUMN IF NOT EXISTS quality_score REAL DEFAULT 0;
```

These unlock:
- `language` — boost FR content, surface multilingual content
- `published_at` — real freshness (vs. created_at = when we indexed it)
- `author` — citation
- `quality_score` — pre-computed at refresh time (length, has-image, African-source)

## Module API contracts

### `query.ts`

```ts
type QueryIntent = 'news' | 'research' | 'local' | 'mixed';

function classifyQuery(query: string, topic: Topic): QueryIntent
function expandQuery(query: string, topic: Topic, lang: 'fr' | 'en'): string[]
function isAfricanContext(query: string): boolean
```

### `bm25.ts`

```ts
function tokenize(text: string): string[]  // FR-aware, lowercase, no accents
function bm25Score(
  query: string[],
  doc: string[],
  idf: Map<string, number>,
  avgdl: number,
  k1?: number,  // default 1.5
  b?: number,   // default 0.75
): number
function buildBM25Index(docs: string[][]): {
  idf: Map<string, number>;
  avgdl: number;
}
```

### `freshness.ts`

```ts
function freshnessScore(
  ageMs: number,           // now - article.publishedAt
  halfLifeMs?: number,     // default 3 days
  floor?: number,          // default 0.05 (never go to 0)
): number  // 0..1
```

### `diversity.ts`

```ts
function applyDiversityCap<T extends { domain: string }>(
  ranked: T[],
  maxPerDomain: number,    // default 2
): T[]  // preserves order, drops overflow
```

### `ranker.ts`

```ts
type ScoreBreakdown = {
  bm25: number;
  freshness: number;
  africanBoost: number;
  quality: number;
  final: number;
};

type ScoredArticle = Article & { scoreBreakdown: ScoreBreakdown };

function rank(
  articles: Article[],
  query: string,
  options: {
    topic: Topic;
    intent: QueryIntent;
    queries: string[];
    now: Date;
  },
): ScoredArticle[]
```

### `pipeline.ts`

```ts
async function runDiscoverPipeline(
  topic: Topic,
  options?: { mode?: 'normal' | 'preview'; limit?: number },
): Promise<{
  articles: ScoredArticle[];
  topics: { key: string; label: string; icon: string }[];
  meta: { generatedAt: string; totalCandidates: number };
}>
```

## Failure modes (what breaks)

| Failure | Impact | Mitigation |
|---------|--------|------------|
| All search engines down | Empty feed | Fall back to Supabase cache (already done in refresh) |
| Query expansion returns 0 variants | Only original query used | Guard: fall back to `queries[0] || query` |
| BM25 divide by zero (avgdl=0) | NaN | Guard: if avgdl=0, return 0 |
| published_at missing | freshnessScore uses created_at | Already handled — created_at is always present |
| Same URL appears 5x in upstream | Waste of compute | Dedup early (existing logic) |
| One domain floods results | Bad UX | Diversity cap in step 7 |
| Article with no content | BM25 = 0 | Title-only fallback in `indexableText` |

## Testing strategy

- Each module has its own test file
- Tests for: happy path, empty input, single element, large input, edge cases (NaN, Infinity, very long strings, unicode)
- Integration test: full pipeline with mocked `searchNews`
- E2E test: 5 real African queries hit `/api/discover/refresh` (with mocked network), verify ordering

Total new tests: ~32. New grand total: 50.

## Rollout

- Commits per module (so each can be reviewed independently)
- No feature flag needed (old random sort is replaced; if pipeline fails, we log + return whatever we have, never empty)
- Smoke test: run refresh, then GET /api/discover?topic=africa, verify top 3 are African sources

## Acceptance criteria

1. `npm test` passes with 50+ tests
2. `npm run lint` clean
3. `npx tsc --noEmit` clean
4. `curl /api/discover/refresh` returns > 50 articles across topics
5. `curl /api/discover?topic=africa` returns articles in deterministic order (same query → same order across two calls within cache TTL)
6. Top 5 of any topic contains ≤ 2 articles from the same domain
7. Documentation at `docs/architecture/PHASE-1-HYBRID-RETRIEVAL.md` + `docs/architecture/ADR/0001-hybrid-ranker-no-embeddings.md`
