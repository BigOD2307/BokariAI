# Phase 2 — Content Extraction at Refresh Time

> **For humans & agents:** This document describes how Bokari's Discover feed extracts, stores, and reuses real article content.  Read this before touching `src/lib/discover/contentExtractor.ts`, `src/lib/discover/metadataExtractor.ts`, or `src/lib/supabase/queries.ts`.

## Why

In Phase 1 the search agent ran `fetchMultipleContent` on every user query, hitting each article's URL fresh.  Same URL → same fetch → 2-6s wasted per question, plus no author or date for citations.

Phase 2 inverts this: **extract once at refresh time, store in Supabase, reuse at query time.**  This makes the search agent ~free for cached URLs and gives the LLM real metadata to cite.

## The two phases of an article

### Refresh time (expensive, runs every 8h)

```
runDiscoverPipeline(topic)
  ↓ ranked articles
extractArticlesInParallel(urls, { maxConcurrent: 5 })
  ↓ for each URL
  fetchAndExtract (HTML → markdown) + extractMetadata (HTML → author/date)
  ↓
upsert to discover_articles with:
  full_content   (markdown, ≤ 4k chars)
  extracted_at   (when we extracted)
  content_hash   (sha-256 of full_content)
  author         (may be richer than what the search engine gave us)
  published_at   (may be richer too)
```

If extraction fails (404, paywall, non-HTML), the row is still upserted with the snippet from the search engine — we never lose an article because extraction failed.

### Search time (cheap, runs per query)

```
webSearch action
  ↓ URLs from search engines
getStoredContentForUrls(urls)
  ↓ Map<url, StoredContent>
for each URL:
  if cache hit  → use stored full_content, skip fetch
  if cache miss → fetchMultipleContent (live), use result
```

Cache failures degrade to live fetch — the agent never crashes because Supabase is down.

## What we extract (and how)

### Article metadata

In `src/lib/discover/metadataExtractor.ts`.  Priority order:

1. **JSON-LD** — `<script type="application/ld+json">` with `@type: NewsArticle / Article`.  Most reliable.
2. **OpenGraph** — `<meta property="article:author">` and `article:published_time`.
3. **Twitter Card** — `<meta name="twitter:creator">` (author only).
4. **Plain meta** — `<meta name="author">`.
5. **`<time>`** — `<time datetime="...">` inside `<article>` or `<main>`.

Always nullable.  If the site doesn't expose any of these, the field stays `null` and we fall back to whatever the search engine told us.

### Article body

In `src/lib/discover/contentExtractor.ts`.  Wraps the existing `fetchAndExtract` from `src/lib/utils/extractContent.ts`:

- Fetch the HTML
- Find `<article>` or `<main>` element
- Convert to markdown via Turndown (strips nav, footer, header, aside, etc.)
- Truncate to 4 000 chars
- Hash with sha-256

Single fetch per URL (we share the raw HTML between `extractMetadata` and the markdown pipeline).

## Storage

`discover_articles` gained three columns in migration `20260603_content_extraction.sql`:

| Column         | Type          | Notes                                                    |
|----------------|---------------|----------------------------------------------------------|
| `full_content` | TEXT          | Markdown, ≤ 4k chars.  Null if extraction failed.         |
| `extracted_at` | TIMESTAMPTZ   | When we last extracted.  Index added for backfill jobs.  |
| `content_hash` | TEXT          | sha-256 of `full_content`.  Lets us detect changes.      |

Existing rows from Phase 1 are untouched; the next refresh fills them in.

## Concurrency

`extractArticlesInParallel` caps at **5 concurrent fetches** by default.  This is a sweet spot:

- Faster than serial (1 fetch × N urls)
- Slower than unbounded (we don't slam the network or get rate-limited)
- Tested explicitly: `extractArticlesInParallel` with 10 URLs and `maxConcurrent: 3` never goes above 3 in-flight.

## Failure modes

| Failure                          | Impact                       | Mitigation                       |
|----------------------------------|------------------------------|----------------------------------|
| URL is 404 / 5xx                 | Article skipped at refresh   | Logged, falls back to snippet    |
| Site is paywalled                | Partial or null content      | Same as 404                      |
| Site returns non-HTML (PDF)      | Extractor returns null       | content-type filter at fetch     |
| Metadata missing                 | author/publishedAt are null  | Schema columns are nullable      |
| 30k refreshes hit Supabase once  | DB overload                  | `maxConcurrent = 5`              |
| Network timeout on a single URL  | Slows batch                  | `AbortController.timeout(8s)`    |
| Cache lookup throws              | Agent crashes                | Try/catch in webSearch action    |

## What we deliberately deferred

- **Re-extraction on demand.**  We re-extract on every refresh.  If a user complains about stale content, Phase 3 adds a "re-extract" button in admin.
- **Full-text search on extracted content.**  No FTS infra yet.  When the corpus grows past ~10k articles we'll add a `tsvector` column.
- **PDF / video extraction.**  Filtered to HTML only at the fetch level.
- **Content re-use for non-Discover URLs.**  `getStoredContentForUrls` only returns rows from `discover_articles`.  The webSearch action still live-fetches URLs the user asks about that aren't in the Discover feed.

## See also

- `docs/superpowers/plans/2026-06-01-phase-2-content-extraction.md` — the agent's execution plan
- `docs/architecture/ADR/0002-refresh-time-extraction.md` — why we chose this architecture
- `src/lib/discover/metadataExtractor.ts` — the metadata parser
- `src/lib/discover/contentExtractor.ts` — the orchestrator
- `src/lib/supabase/queries.ts` — the cache lookup

## Test coverage

| File                                     | Tests | What it proves                                |
|------------------------------------------|------:|-----------------------------------------------|
| `tests/discover/metadataExtractor.test.ts` | 15  | JSON-LD, OG, Twitter, `<time>`, priority      |
| `tests/discover/contentExtractor.test.ts`  | 10  | Happy path, timeouts, concurrency, hash      |
| `tests/discover/refreshExtraction.test.ts` |  4  | End-to-end pipeline + row shape               |
| `tests/agents/webSearchCache.test.ts`      |  5  | Cache hit, miss, fallback                     |
| **Phase 2 total**                         | **34** |                                            |
| **All tests**                             | **151** | (up from 117 in Phase 1)                   |
