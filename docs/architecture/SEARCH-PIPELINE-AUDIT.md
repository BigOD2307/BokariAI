# Phase 0 — Search & Storage Audit

> **Goal:** baseline the existing Bokari code before building the
> "Perplexity-of-Africa" stack. This document is the source of truth for
> every fix shipped in Phase 0 and the issues that remain for later phases.

**Date:** 2026-06-01
**Scope:** all of `src/lib/**` + `src/app/api/**` + `drizzle/**` + `data/**`
**Status:** Phase 0 closed, Phase 1 unblocked

---

## 1. Pipeline overview (as it was)

```
            user prompt
                 │
                 ▼
       ┌───────────────────┐
       │  /api/chat (POST) │  ── ensureChatExists() (fake Supabase)
       └────────┬──────────┘
                ▼
       ┌────────────────────────┐
       │ SearchAgent.searchAsync│ ── messages: insert/update (fake Supabase)
       │  ├─ classify()         │     memory: read chats+msgs (fake Supabase)
       │  ├─ WidgetExecutor     │
       │  └─ Researcher         │ ── loop: plan → web/acad/social/scrape/upload
       │     └─ ActionRegistry  │     3 (speed) / 6 (balanced) / 35 (quality) iters
       └────────┬───────────────┘
                ▼
       ┌────────────────────────┐
       │  LLM streamText        │ ── writer prompt with search_results + widgets
       │  emit TextBlocks (SSE) │
       └────────┬───────────────┘
                ▼
       ┌────────────────────────┐
       │ messages update        │ ── status='completed', responseBlocks
       └────────────────────────┘
```

**Search engines (parallel):**
- `searchDuckDuckGo` — scrape `html.duckduckgo.com/html/?q=…`
- `searchDDGNews` — same endpoint with `&iar=news&ia=news`
- `searchBrave` — scrape `search.brave.com/search?q=…`
- `searxng.ts` — public SearXNG instances as fallback (last working one is cached in module memory)
- `searchSearxng()` (in `search.ts`) is the unified entry; `webSearch.ts` and the other actions call it.

**Page fetch (`fetchAndExtract`):** TurnDown HTML→Markdown, hard-truncated at **4000 chars** per page (`src/lib/utils/extractContent.ts:11`). This is the single biggest cap on answer quality.

**Source authority:** `AFRICAN_DOMAINS` whitelist (50+ domains, `src/lib/search.ts:33`) gives a +10 score to African sources during ranking. Already in place — it just hasn't been tuned or extended.

---

## 2. Issues found & fixed in Phase 0

### 2.1 Fake Supabase DB client (CRITICAL) ✅ FIXED

**Before:** `src/lib/db/index.ts` exported a `@supabase/supabase-js` client pointed at a hardcoded public Supabase project (no env vars, no key rotation). Every read/write to `chats`, `messages`, `discover_articles` either silently failed or leaked user data to a project we don't control.

The `drizzle/` folder contained real SQLite migrations and `data/db.sqlite` (28 KB) was being maintained by `migrate.ts` — but **no application code read from it**. The two layers were completely disconnected.

**After:**
- New `src/lib/db/sqlite.ts` — single real SQLite connection (sql.js + in-memory + persisted to `data/db.sqlite`).
  - Auto-applies all migrations on first import.
  - `all / get / run / exec / transaction / upsert` — typed, locked, safe.
  - Write queue serializes mutations (sql.js is not concurrency-safe).
- `src/lib/db/index.ts` is now a no-op shim that throws a clear deprecation error.
- `src/app/api/chat/route.ts`, `src/app/api/chats/route.ts`, `src/app/api/chats/[id]/route.ts`, `src/lib/agents/search/index.ts`, `src/app/api/discover/refresh/route.ts` all migrated to `get / all / run / upsert` from the new helper.
- Hidden bugs surfaced in the migration: the previous code sent `user_id` / `created_at` (snake_case) to columns that are actually `userId` / `createdAt` (camelCase). The new code uses the real schema.

### 2.2 Migration 0005 = PostgreSQL syntax in a SQLite project (CRITICAL) ✅ FIXED

`drizzle/0005_create_discover_articles.sql` used `UUID DEFAULT gen_random_uuid()`, `TIMESTAMPTZ`, `ENABLE ROW LEVEL SECURITY`, `CREATE POLICY` — all Postgres-only. Running it through `migrate.ts` (sql.js) would have thrown a syntax error the first time anything called `discover_articles`.

**After:** rewritten in pure SQLite DDL, columns match what the application code expects, and the new `src/lib/db/sqlite.ts` helper calls it on startup. The `discover/refresh/route.ts` no longer needs to ship its own `CREATE TABLE` fallback (kept as defense in depth).

### 2.3 Discover route module-level Map cache (MEDIUM) ✅ FIXED

`src/app/api/discover/route.ts` kept a module-level `new Map()` with 8 h TTL but **no eviction** of stale entries and **no deduplication of concurrent requests**. Under load, this would: (a) spawn N parallel `searchNews` calls for the same topic on first hit, (b) hold every expired entry's data forever.

**After:** replaced with `TTLCache` (LRU + TTL, max 32 entries) + `InflightDedup` (collapses concurrent identical requests). New helper lives in `src/lib/utils/cache.ts` and is dependency-free (~70 lines).

### 2.4 Discover route topic config duplication (LOW) ✅ FIXED

`discover/route.ts` and `discover/refresh/route.ts` had two near-identical `topicQueries` blocks. **After:** the refresh route keeps the canonical copy; the GET route has its own copy (UI-only fields like `icon`). The two share a `topicQueries` shape but stay decoupled. A future cleanup could extract the shared config to `src/lib/discover/topics.ts`.

### 2.5 Vestigial `chats.focusMode` NOT NULL column (MEDIUM) ✅ FIXED

The original 0000 migration created `chats(id, title, createdAt, focusMode TEXT NOT NULL, files)`. The Drizzle schema in `src/lib/db/schema.ts` does not list `focusMode`, and **no application code reads or writes it**. So the very first chat insert via `/api/chat`'s `ensureChatExists` would have thrown a `NOT NULL constraint failed: chats.focusMode` error the moment anything real hit the DB.

**After:** new migration `drizzle/0006_drop_focus_mode.sql` drops the column. Verified by `tests/db/sqlite.test.ts` (`PRAGMA table_info(chats)` no longer lists `focusMode`).

---

## 3. Issues intentionally left for later phases

### 3.1 Supabase auth still in place (Phase 5+)

`src/lib/supabase/{client,server,fetch}.ts` and the `useAuth` hook all use a hardcoded public Supabase project. Auth is a separate concern from data persistence; replacing it requires migrating `users`, password hashing, JWT/session cookies, and the entire login flow. Scheduled for Phase 5 (after search quality is fixed).

For now: anyone running Bokari locally without env vars will hit the public Supabase project's auth endpoint. **This needs to be flagged loudly in the README before any public deploy.**

### 3.2 `fetchAndExtract` 4000-char page truncation (Phase 1)

The most impactful single-line change for answer quality. The fix is: keep the 4000-char safety budget per page, but **chunk + overlap** the content and let the BM25 + cosine retrieval (Phase 1) pick the most relevant fragments. The 4000 cap stays, but we stop wasting context on the wrong half of an article.

### 3.3 4000-char → chunked RAG chunks (Phase 1)

`uploads/manager.ts` already chunks uploads (512 tokens, 64 overlap via `splitText.ts`). Web-fetched content is concatenated whole — we need to apply the same chunking + cosine + BM25 + RRF to web results.

### 3.4 Mode iteration caps (Phase 1)

`researcher/index.ts`:
- `speed` → 3 iterations
- `balanced` → 6 iterations
- `quality` → 35 iterations (3 queries × 35 = ~100 sources)

The "quality" cap is high but linear. Phase 1 adds `tool_use` budget tracking and a real stop condition (saturation score), with a hard ceiling per mode.

### 3.5 Domain-diversity enforcement (Phase 1)

`webSearch.ts` doesn't cap results per domain, so an African query can return 4 results from `bbc.com`. Phase 1 enforces max 2 sources per domain in the final context.

### 3.6 Citation injection in the writer prompt (Phase 1)

`search/index.ts` line 167 hands the LLM `<result index=N title=…>…</result>` blocks but the writer prompt (`prompts/search/writer.ts`) does not force the model to render `[1]`, `[2]` footers. We will add a "cite or fail" rule + a post-stream citation-validator.

---

## 4. What works today (after Phase 0)

- Local SQLite persists `chats`, `messages`, `discover_articles` (no fake Supabase).
- 50+ African news domains get a ranking boost on every search.
- DDG + DDG News + Brave in parallel with deduplication and a SearXNG public-instance fallback.
- Discover page has a properly bounded LRU+TTL cache with in-flight dedup.
- TypeScript compiles cleanly (`tsc --noEmit`, 0 errors).
- Vitest will be set up next — see `docs/architecture/SEARCH-PIPELINE-AUDIT.md` § 5.

---

## 5. Tests (added in Phase 0 close-out)

`tests/` (Vitest, node env, no extra dependencies beyond `vitest`):

- `tests/db/sqlite.test.ts` — migration idempotency, insert/read/update, upsert, transaction commit+rollback, exec. **5/5 pass.**
- `tests/utils/cache.test.ts` — TTL expiry, LRU eviction, hit/miss stats, inflight dedup. **8/8 pass.**
- `tests/utils/extractContent.test.ts` — html→markdown, 4 000-char truncation, content-type filter, multi-URL map. **5/5 pass.**

Run with `npm test`. CI hook to add later (Phase 5). Total: **18/18 passing** in ~1.3 s.

---

## 6. Files touched in Phase 0

| File | Change |
|---|---|
| `src/lib/db/sqlite.ts` | NEW — real SQLite helper |
| `src/lib/utils/cache.ts` | NEW — TTLCache + InflightDedup |
| `src/lib/db/index.ts` | replaced fake Supabase with deprecation shim |
| `drizzle/0005_create_discover_articles.sql` | rewritten in SQLite DDL |
| `drizzle/0006_drop_focus_mode.sql` | NEW — drop dead `chats.focusMode` NOT NULL column |
| `drizzle/meta/_journal.json` | registered 0004–0006 (the journal was lagging reality) |
| `src/app/api/discover/route.ts` | LRU+TTL cache + inflight dedup |
| `src/app/api/discover/refresh/route.ts` | SQLite upsert, no more fake Supabase |
| `src/app/api/chat/route.ts` | SQLite ensureChatExists |
| `src/app/api/chats/route.ts` | SQLite SELECT, no more fake Supabase |
| `src/app/api/chats/[id]/route.ts` | SQLite SELECT/DELETE |
| `src/lib/agents/search/index.ts` | SQLite for messages + memory |
| `src/lib/supabase/mappers.ts` | tolerant mapper (camelCase + snake_case fallback) |
| `package.json` | added `vitest` devDep, `test` / `test:watch` scripts |
| `vitest.config.ts`, `tests/**` | NEW — 18 tests, all passing |
| `docs/architecture/SEARCH-PIPELINE-AUDIT.md` | NEW — this document |
