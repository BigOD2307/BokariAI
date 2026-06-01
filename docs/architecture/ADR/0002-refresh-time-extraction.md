# ADR 0002 — Extract article content at refresh time, not query time

- **Status:** accepted (2026-06-01)
- **Decider:** Amadou (backend lead), after the user (Ousmane) approved Phase 2 scope

## Context

In Phase 1, the search agent re-fetched the top 2-6 URLs of every user query inside `webSearch.ts`.  This meant:

1. Same URL → same fetch → 2-6 seconds wasted per repeat query.
2. We had no `author` or `publishedAt` for citations — the LLM could only quote a search snippet.
3. The Discover refresh already touched the same URLs (to populate the feed), so we were doing the work twice.

We need real article content for two reasons:
- **Speed** at query time.  Repeat questions should not re-fetch.
- **Quality** of citation.  The LLM should be able to write "according to Aminata Traoré at RFI, 30 May 2026, …".

## Options considered

### Option A — Refresh-time extraction (chosen)

Run the extractor during `/api/discover/refresh` for every kept article.  Store `full_content`, `extracted_at`, `content_hash` in `discover_articles`.  At query time, `webSearch` looks up the cache by URL and skips the fetch on hit.

**Pros**
- One fetch per article per refresh (8h), not per query.
- Per-URL extraction can be parallelized and bounded.
- Gives the LLM rich metadata (author, date) for citations.
- Same data feeds the Discover UI — extract once, use everywhere.

**Cons**
- Adds 30-60s to the refresh job.
- Stale-by-default: an article updated between refreshes shows old content until next refresh.
- Requires new columns + new module.

### Option B — Query-time extraction (status quo)

Keep extracting at query time.  Add a small per-URL cache so the same URL within a single query reuses one fetch.

**Pros**
- Always fresh.
- No new schema.

**Cons**
- First query is still slow.
- No metadata for citations.
- 100% wasted work for any URL in the Discover feed.

### Option C — Embeddings + vector cache (rejected for now)

Embed the article body at refresh time, store vectors, retrieve by similarity.  Defers the metadata problem but doesn't solve the per-query latency (still 50-200ms for vector lookup + LLM context window cost).

## Decision

**Option A.**  Refresh-time extraction, with a query-time cache lookup.  We accept the staleness (≤ 8h) because Bokari is a news-feed product, not a stock ticker.

## Implementation

- `src/lib/discover/metadataExtractor.ts` — parse HTML for author, publishedAt, canonicalUrl
- `src/lib/discover/contentExtractor.ts` — orchestrator: fetch + parse + hash, with parallel batch helper
- `src/lib/supabase/queries.ts` — `getStoredContentForUrls(urls)` bulk lookup
- `src/app/api/discover/refresh/route.ts` — calls `extractArticlesInParallel` before upsert
- `src/lib/agents/search/researcher/actions/webSearch.ts` — looks up cache before live-fetch

New columns: `full_content`, `extracted_at`, `content_hash`.

## Consequences

- Refresh job is now ~30-60s longer per topic (5-concurrent batch × 30 articles × ~4s avg).
- `discover_articles` row size grows by ~4kB per row.  At 7-day retention × 30 articles × 7 topics ≈ 1500 rows × 4kB = ~6MB.  Negligible.
- Future phases can add `content_hash` change-detection to skip re-extraction when the article hasn't changed.
- We can later add a "re-extract now" admin button without schema change.
