# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Canonical reference

`AGENTS.md` is the canonical agent guide for this repo and is kept current. Read it first — it covers the build/test/lint/eval commands, the dual-database split (local SQLite vs Supabase Postgres), the search pipeline, the Vitest setup, the Docker/CI story, and repo conventions (French UI / English code, Conventional Commits, `--webpack` lock-in, source-available license).

@AGENTS.md

The sections below are a **verified delta**: subsystems added after `AGENTS.md` was written, plus doc-drift corrections confirmed against the actual code. When they disagree with `AGENTS.md`, the README, or `docs/`, the text here is the one checked against source.

## Doc-drift corrections (verified against source)

- **TinyFish is gone.** `README.md`, `docs/architecture/README.md` (line 12), `docs/architecture/WORKING.md`, and `CONTRIBUTING.md` (line 19) still call TinyFish the primary search engine. It is not in any source file. `src/lib/search.ts` runs **DuckDuckGo HTML + DuckDuckGo News + Brave** in parallel (`Promise.all`, ~line 243), dedupes, and ranks with African-domain boosting. `src/lib/searxng.ts` is a **separate** fallback (local SearXNG → public instances). Note the two coexisting search paths: the researcher agent action (`src/lib/agents/search/researcher/actions/webSearch.ts`) calls `searchSearxng()` (→ `searxng.ts`), *not* the multi-engine scraper in `search.ts`.
- **`EmptyChat.tsx` was deleted**, replaced by the `src/components/home/` landing tree (`Home.tsx` orchestrates `Hero` / `ChatPrompt` / `DiscoverSection` / `CTASection` / `HomeFooter`) and `src/components/EmptyChatMessageInput.tsx`.
- **Setup is opt-in, not enforced.** README says a wizard guides you on first launch; in reality nothing redirects or blocks when `setupComplete` is false. `/setup` does double duty: Supabase table introspection (shows SQL from `supabase/migrations/`) *and* provider/key configuration.

## Authentication (`src/lib/auth/`)

Three independent paths; auth is **not** plain Supabase Auth despite what the README implies.

- **WhatsApp OTP** (`src/lib/auth/whatsapp/`): passwordless 6-digit OTP over WhatsApp. `provider.ts` is a router selected by `WHATSAPP_PROVIDER` (`meta` | `kapso` | `dual`) — **default is `meta`**, the codebase is mid-migration to Kapso. `kapso-client.ts` wraps `@kapso/whatsapp-cloud-api`; `meta-client.ts` is the legacy direct Graph API client kept for rollback **until 3 July 2026** (see `docs/TODO-kapso-cleanup.md` before deleting it). OTPs are bcrypt-hashed in **local SQLite** via `otp-store.ts` (5-min TTL, 3 attempts, 5/phone/hour). `jwt.ts` mints the session cookie `sb-bokari-auth-token` (httpOnly, 7-day). Phone users get a synthetic email `${phone}@whatsapp.bokari.app`, `authProvider='whatsapp'`.
  - Gotchas: both `provider.ts` and `kapso-client.ts` **cache** their config at startup — use `resetProviderCache()` / `resetKapsoClientCache()` after env changes (the test setup relies on this). The webhook verifier reads both Meta (`X-Hub-Signature-256`) and Kapso (`X-Webhook-Signature`) headers. Kapso env vars fall back to their `META_*` equivalents when unset. Required envs are stubbed in `tests/setup.ts` (`META_WHATSAPP_*`, `KAPSO_*`) — add new required auth envs there or tests break at import time.
- **Guest mode** (`src/lib/auth/guest.ts`, `src/app/api/guest/track/`): anonymous use, **3 queries / 24h**, SQLite-backed. `GUEST_DAILY_LIMIT` is duplicated in `src/lib/auth/guest.ts` **and** `src/lib/hooks/useAuth.tsx` — keep them in sync.
- **Turnstile** (`src/app/api/turnstile/verify/`): Cloudflare bot check exists but is **not wired to the frontend**; returns `{verified:false, skipped:true}` when `CLOUDFLARE_TURNSTILE_SECRET` is unset.
- `src/lib/auth/country.ts` detects country via cookie (defaults to Senegal `SN`; ~15 African countries + France).

## Learn mode (`src/lib/agents/learn/`) — schema-only, not yet wired

Spaced-repetition flashcards (SM-2 via `@open-spaced-repetition/sm-2`), planned as a free B2C acquisition feature. **Currently schema + prompt only:**

- `learn/prompt.ts` has the Socratic + `learnBundlePrompt` (generates flashcards + quiz JSON from search results).
- Tables exist in **both** DBs: `drizzle/0008_learn_mode.sql` (SQLite) and `supabase/migrations/20260609_learn_mode.sql`. Cards default `easeFactor=2.5, interval=0, repetitions=0`.
- `Flashcard`, `FlashcardBlock`, `QuizBlock` types are in `src/lib/types.ts`.
- **Missing (do not assume these exist):** no `/api/flashcards|decks|learn` routes, no SM-2 grade→interval logic (the npm package is installed but never called), no renderer for `flashcard`/`quiz` blocks, and no integration calling `learnBundlePrompt` from the search agent.

## Async deep research + observability

- **Async research** (`src/app/api/research-async/`, `src/lib/agents/search/async.ts`, `src/lib/jobs/research.ts`): the `quality`/"Approfondie" mode (~35 iterations, 30–60s) would blow the SSE timeout, so it runs as a background job. POST creates a job and returns `202 + jobId`; the client polls GET. The job store is an **in-memory `Map`** (cap 100, pruned after 1h) — jobs do not survive a process restart and won't work across serverless containers. Polling is **intentionally unauthenticated**: the 128-bit `jobId` is the bearer secret.
- **Observability** (`src/lib/observability/`): `latence.ts` is a stateless nanosecond timer that `console.warn`s per-stage; `ttfb.ts` is an in-memory per-stage timing store (LRU-capped) exposing p50/p95/p99. These measure **per-stage** timings, not HTTP request latency. See `docs/architecture/PERFORMANCE.md`.

## AI layer split: `src/lib/ai/` vs `src/lib/models/`

- `src/lib/ai/` = high-level orchestration: `gateway.ts` (single entry for chat/embeddings + provider fallback), `config.ts` (env-driven routes; **BGE-M3 embeddings hardcoded to 1024 dims** — `BOKARI_EMBEDDING_DIMENSIONS` must match if you swap models or cosine breaks), `embedCache.ts` (in-memory LRU query→vector, disable via `EMBED_CACHE_DISABLED`), `reranker.ts` (cross-encoder; `live` OpenRouter vs `offline` deterministic — tests use offline, set `BOKARI_RERANK_ENABLED=true` for live).
- `src/lib/models/` = provider abstraction: `registry.ts` (lazy-loaded loader), `base/{llm,embedding}.ts` (abstract classes), `providers/` (openai, anthropic, groq, openrouter, ollama, gemini, lemonade, lmstudio, transformers).
- **Semantic cache** (`src/lib/cache/`): SQLite-backed (`store.ts`, better-sqlite3 WAL), query→response with a **0.92 cosine threshold** (`semantic.ts`), float32 packing in `vector.ts`. Linear O(N) scan — fine to ~50k entries. Distinct from `ai/embedCache.ts`.
- Chat fallback (`gateway.ts`) fires **only** when the primary provider throws on *load*; a bad response from a loaded primary is not retried — by design.

## Public sharing + the viral blur pattern (`src/components/Public/`, `src/app/p/[slug]/`)

Sharing a chat creates a public read-only page at `/p/[slug]` (ISR `revalidate=3600`). The answer is rendered with `filter:blur(7px)` + `user-select:none` and a WhatsApp sign-up overlay for unauthenticated / quota-exhausted visitors — this is the intentional acquisition mechanic. Shares are **Google-indexed by default** (`is_indexed=true`; opt-out in Settings ▸ Privacy). Share creation (`POST /api/shares`) is idempotent (200 existing / 201 new). The public read endpoint (`GET /api/p/[slug]`) strips internal markup (markdown images, chart specs, code fences, citation brackets, source tags) before returning. Schema: `supabase/migrations/20260608_shares.sql` (`shares` + `share_views`, RLS-protected analytics). CRUD lives in `src/lib/auth/shares.ts`.
