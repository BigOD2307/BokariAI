# Phase 4 — Citation Engine

> Ground the agent's answers in Bokari's own Discover corpus using
> BGE-M3 cosine similarity.  When the user asks about African news,
> tech, or finance, the agent cites Bokari-indexed articles instead
> of (or alongside) the open web.

## Why

Before Phase 4, the chat agent searched only the open web
(SearXNG) for context.  Three problems:

1. **Latency.** SearXNG hits several search engines, each with
   1-3s latency.  A typical user-visible round-trip is 8-12s.
2. **Cost.** Live fetches cost $0 in our stack but they do cost
   the upstream services — and the results aren't always relevant
   to African job seekers.
3. **Authority.** Web results are heterogeneous quality.  A Bokari
   citation ("according to RFI…") feels more grounded than
   "according to some random blog I found".

The Citation Engine flips the default: when the user asks something
within Bokari's indexed scope, we answer with **Bokari citations
first**, falling back to the web only when we don't have a high-
confidence match.

## What ships in Phase 4

### 1. `discoverCosineSearch` — pure in-memory cosine

`src/lib/discover/search.ts` — a pure function:

```ts
function discoverCosineSearch(
  queryEmbedding: number[],
  candidates: readonly DiscoverCandidate[],
  options?: { limit?, minScore?, topic? },
): DiscoverSearchHit[]
```

- Filters candidates by topic (optional, case-insensitive).
- Computes cosine, drops below `minScore` (default 0.55, just
  above the neutral 0.5).
- Sorts by score (most similar first), tie-breaks by
  `publishedAt` (most recent first).
- Returns up to `limit` hits (default 5).
- Pure, deterministic, no I/O, no clock.

### 2. `getEmbeddedDiscoverCandidates` — Supabase helper

`src/lib/supabase/queries/discover.ts` — fetches the most recent
500 articles with embeddings from the last 30 days, optionally
filtered by topic.  Never throws; returns `[]` on Supabase error.

### 3. `discover_search` — the agent tool

`src/lib/agents/search/researcher/actions/discoverSearch.ts` — a
new tool the LLM can call:

```ts
{
  name: 'discover_search',
  schema: { queries: [string], topic?: string, limit?: number, minScore?: number }
  enabled: always (when search is not skipped)
}
```

Flow:
1. UI sub-step: "Recherche de 1 requête" (or 2/3)
2. Embed queries via BGE-M3 (gateway)
3. Pull 500 candidates from Supabase
4. Cosine search for each query, merge by max score
5. UI sub-step: "5 sources trouvées"
6. Return chunks with `metadata.source = 'bokari-discover'`

The chunks feed the agent's context, so it can quote the
articles, and the UI can render them as citations below the
response.

### 4. Citation rendering

`src/components/AssistantSteps.tsx` — citation chips now show a
small "Bokari" badge when the source is from our own index.  This
lets the user know the agent grounded its answer in Bokari's
verified corpus (vs. random web).

### 5. `discover_search` is registered alongside web/academic

`src/lib/agents/search/researcher/actions/index.ts` — the new
action joins the registry.  No classifier changes needed for
V1: the action is always available when `skipSearch === false`.

## Ranker integration

`Phase 3` wired cosine into the **Discover feed** (BM25 + cosine
+ freshness + African boost).  `Phase 4` wires cosine into the
**chat agent** (BGE-M3 over Bokari's corpus).  Same model, same
embedder, two different use cases:

- Discover feed: rank a small candidate set (30-100 articles)
  pre-fetched by topic + search engines.
- Citation engine: rank a large candidate set (up to 500
  articles) pre-fetched by recency, scoped by an optional topic.

When the corpus grows past ~5k embedded articles, we'll swap
both to pgvector + HNSW.  The app-side code doesn't change.

## Test coverage

203 unit tests passing (+23 from Phase 3).  New in Phase 4:
- `tests/discover/search.test.ts` — 14 cases (cosine + filters
  + tie-breaks + truncation)
- `tests/agents/discoverSearch.test.ts` — 9 cases (mocked
  gateway + Supabase, verifies schema, enabled, ranking, merge
  by max score, failure modes)

## Live behaviour (manual test plan)

1. Run `npx tsx scripts/smoke-gateway.ts` — verify BGE-M3 still
   works.
2. Trigger `/api/discover/refresh?topic=africa` to backfill
   embeddings.
3. Open a chat and ask: "What's the latest news from Bamako?"
4. The agent should call `discover_search` first, then either
   answer with the citations or fall back to `web_search`.
5. The chat UI should show citation chips with a "Bokari" badge
   for our sources and no badge for web sources.

## Cost

Per chat message with one `discover_search` call:
- 1-3 query embeddings × $0.00000015/1M tokens ≈ effectively
  free.
- 500 candidate rows × 1024 floats × 8 bytes ≈ 4 MB JSON over
  the wire per call.  Cheap.
- 500 cosines in JS ≈ 3ms on V8.

At 10k chat messages / day, total Phase-4 marginal cost is
$0.10–$0.30/day, dominated by token costs in the chat model
itself.

## What this unlocks (Phase 5+)

- **Multi-source answers** — the agent can weave Bokari
  citations and web citations in the same response, with
  clear visual badges.
- **"Show me the evidence"** — the citation chips become a
  jump-to-source link, so a curious user can verify the
  agent's claims in one click.
- **Citation quality metrics** — Phase 6: log which citations
  users actually click.  Use that as the eval signal for
  BGE-M3 quality on African languages.
- **pgvector swap** — when we exceed 5k embedded articles,
  swap to pgvector + HNSW.  Zero app-side change.
