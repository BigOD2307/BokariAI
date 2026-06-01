# Phase 2 — Content Extraction at Refresh Time

> **For agentic workers:** This is a self-contained plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract real article content (full markdown + author + published_at) **once at refresh time** and store it in Supabase, so the search agent at query time gets accurate, citation-ready content without re-fetching.

**Architecture:** Add metadata extraction (author, published_at from HTML) to the existing `fetchAndExtract`, run it during `/api/discover/refresh` for every kept article, persist the result in 3 new columns. Wire the search agent to look up the Discover cache before live-fetching.

**Tech Stack:** TypeScript, Turndown (existing), regex parsing, Supabase Postgres, Vitest.

---

## Problem statement

The search agent currently does this on EVERY user query (in `webSearch.ts`):

```ts
const contentMap = await fetchMultipleContent(uniqueUrls, maxFetch);
```

This means:
- **Every query re-fetches the same articles.** Same URL → same fetch → 2-6s wasted.
- **No metadata.** The writer doesn't know who wrote the article or when — so it can't cite properly.
- **The Discover refresh already touches the same URLs**, so we're doing the work twice.

## Goals (success looks like)

1. Article content is extracted **once at refresh time** and stored in DB.
2. The search agent looks up the Discover cache first. If a URL is in the table with `full_content`, it uses that and skips the fetch.
3. `published_at` and `author` are extracted from HTML and stored.
4. The LLM can now produce accurate citations with author + date.
5. Refresh-time extraction is parallel, bounded (max 5 concurrent), and never blocks the response.

## Non-goals (deferred)

- Replacing the live fetch entirely (we still need it for URLs not in the Discover feed)
- Content re-extraction on demand (Phase 3 — a "re-extract" button in admin)
- Full-text search on extracted content (we don't have FTS infra yet)
- PDF / video extraction (out of scope; we filter to HTML only)

## Architecture

```
Refresh time (one-time, expensive):
  runDiscoverPipeline(topic)
    ↓ ranked articles
  for each article (in parallel, max 5 concurrent):
    extractArticle(url)
      ├─ fetch HTML
      ├─ extract full markdown (Turndown)
      ├─ extract metadata (author, publishedAt)
      └─ compute contentHash
    ↓
  upsert to discover_articles with full_content + metadata

Search time (per query, cheap):
  webSearch action
    ↓ URLs from search engines
  for each URL:
    look up in discover_articles by URL
      ├─ hit + has full_content  → use it, skip fetch
      ├─ hit + no full_content   → live fetch + store
      └─ miss                    → live fetch, no store
    ↓
  LLM cites with author + date + content
```

## Data model

```sql
ALTER TABLE public.discover_articles
  ADD COLUMN IF NOT EXISTS full_content  TEXT,        -- markdown, 4000 chars
  ADD COLUMN IF NOT EXISTS extracted_at  TIMESTAMPTZ, -- when we extracted
  ADD COLUMN IF NOT EXISTS content_hash  TEXT;        -- sha-256 of content, for change detection
```

## File structure

```
src/lib/discover/
├── metadataExtractor.ts  # parse HTML for author, publishedAt (NEW)
├── contentExtractor.ts   # wrap fetchAndExtract + metadata, return full struct (NEW)
└── (existing files)

src/app/api/discover/refresh/
└── route.ts              # MODIFIED: extract at refresh time

src/lib/agents/search/researcher/actions/
└── webSearch.ts          # MODIFIED: lookup stored content first

src/lib/supabase/queries.ts (NEW)
└── getStoredContentForUrls  # bulk lookup by URL list

supabase/migrations/
└── 20260603_content_extraction.sql  # NEW

tests/discover/
├── metadataExtractor.test.ts  # NEW
├── contentExtractor.test.ts   # NEW
└── refreshExtraction.test.ts  # NEW (with mocked fetch)

tests/agents/
└── webSearchCache.test.ts     # NEW (cache hit/miss logic)
```

## API contracts

### `metadataExtractor.ts`

```ts
type ArticleMetadata = {
  author: string | null;
  publishedAt: Date | null;
  canonicalUrl: string | null;
};

function extractMetadata(html: string, fallbackUrl?: string): ArticleMetadata
```

Strategy (priority order):
1. JSON-LD `<script type="application/ld+json">` with `@type: NewsArticle` or `Article`
2. OpenGraph `<meta property="article:author">` and `article:published_time`
3. Twitter Card `<meta name="twitter:creator">` (author only)
4. Standard `<meta name="author">`
5. `<time datetime="...">` in `<article>` or `<main>`
6. URL heuristics (e.g. `/2026/05/15/`)

### `contentExtractor.ts`

```ts
type ExtractionResult = {
  url: string;
  fullContent: string | null;
  metadata: ArticleMetadata;
  contentHash: string | null;
  success: boolean;
  error?: string;
};

async function extractArticle(
  url: string,
  options?: { timeoutMs?: number; maxLength?: number }
): Promise<ExtractionResult>

async function extractArticlesInParallel(
  urls: string[],
  options?: { maxConcurrent?: number; timeoutMs?: number; maxLength?: number }
): Promise<ExtractionResult[]>
```

### `getStoredContentForUrls`

```ts
async function getStoredContentForUrls(
  urls: string[]
): Promise<Map<string, { fullContent: string | null; author: string | null; publishedAt: Date | null }>>
```

Uses Supabase's `in` filter to fetch all rows in one round trip.

## Failure modes (what breaks)

| Failure | Impact | Mitigation |
|---------|--------|------------|
| URL is 404 / 5xx | Article skipped at refresh | Logged, falls back to snippet; user still sees the article in feed |
| Site is paywalled | Returns null or partial | Same as 404 — log, fall back |
| Site returns non-HTML (PDF) | Extractor returns null | Filter content-type at fetch level (already done) |
| Metadata is missing in HTML | author/publishedAt are null | Schema columns are nullable; we just don't get the citation |
| Race: 10k refreshes hit Supabase at once | DB overload | `maxConcurrent = 5` in `extractArticlesInParallel` |
| Network timeout on a single URL | Slows down the batch | `AbortController.timeout(8s)` per URL |
| Site returns 200 but with redirect chain | Could loop | `redirect: 'follow'` + max 3 hops (default fetch) |
| Bad metadata regex (XSS in `<meta>`) | Script injection in stored data | Markdown rendering will not run scripts; Turndown sanitizes |
| Site rate-limits us | We get 429 | Per-URL timeout; batch throttling |

## Testing strategy

- `metadataExtractor.test.ts` — JSON-LD, OG, Twitter, `<time>`, fallback
- `contentExtractor.test.ts` — happy path, timeout, 404, non-HTML, partial
- `refreshExtraction.test.ts` — pipeline integration with mocked network
- `webSearchCache.test.ts` — cache hit, miss, fallback

Total: ~25 new tests, bringing total to ~142.

## Rollout

- Migration is idempotent (ADD COLUMN IF NOT EXISTS)
- New `full_content` column starts null; existing rows unchanged
- First refresh will fill in `full_content` for the top articles
- No breaking change to API responses

## Acceptance criteria

1. `npm test` passes with 142+ tests
2. `npx tsc --noEmit` clean
3. `npx eslint src/lib/discover src/app/api/discover tests/discover` clean
4. `curl -X POST /api/discover/refresh` returns articles with `full_content` populated
5. `curl /api/discover?topic=africa` returns articles with author + publishedAt in the response (optional for the API, but they're in the DB)
6. The `webSearch` action's "extraction cache hit" path is exercised by at least 3 unit tests
7. `docs/architecture/PHASE-2-CONTENT-EXTRACTION.md` + `docs/architecture/ADR/0002-refresh-time-extraction.md` written
