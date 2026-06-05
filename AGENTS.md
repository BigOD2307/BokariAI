# AGENTS.md — Bokari

African-targeted RAG search engine. Next.js 16 (App Router) + TypeScript + Tailwind 3 + shadcn/ui ("base-nova") + custom LLM/Search agents. Reads as a chat product; ships as a multi-arch Docker image.

> French UI, English code/comments. Conventional Commits. License is **source-available, non-commercial** — credit Ousmane Dicko / Dicken AI in any fork (see `LICENSE`).

## Quick start

```bash
npm install
cp .env.example .env.local          # then fill Supabase + LLM keys
npm run dev                         # http://localhost:3000
```

`/setup` on first launch detects missing Supabase tables and shows the SQL to paste. CLI alternative: `SUPABASE_ACCESS_TOKEN=sbp_… node scripts/apply-migrations.js` (no token → prints a copy-pasteable command and exits).

## Commands (root `package.json`)

| Task | Command |
|---|---|
| Dev (port 3000) | `npm run dev` |
| Prod build | `npm run build` |
| Prod start | `npm run start` |
| Lint | `npm run lint` |
| Format | `npm run format:write` |
| Tests (single-run) | `npm run test` |
| Tests (watch) | `npm run test:watch` |
| Retrieval eval (live, needs `OPENROUTER_API_KEY`) | `npm run eval` |
| Retrieval eval (offline) | `npm run eval:offline` |
| Retrieval eval (cached vectors) | `npm run eval:precomputed` |
| **CI gate** — fails if NDCG@10/MRR/hit-rate drop > 0.02 | `npm run eval:check` |
| Intentionally raise the baseline | `npm run eval:update-baseline` |

> **Don't switch off `--webpack`.** `dev` and `build` both pass `next dev --webpack` / `next build --webpack`. Turbopack gives different bundle behavior — leave as-is unless asked.

> `package-lock.json` and `yarn.lock` both exist. Dockerfiles use **yarn**; everything else is fine on either. Don't run both — pick one lockfile.

## Architecture (1-minute tour)

- **Entry:** `src/app/layout.tsx` → `src/app/page.tsx` (chat) / `src/app/c/[chatId]` / `src/app/library` / `src/app/discover` / `src/app/p/[slug]` (public share) / `src/app/setup`.
- **API routes** under `src/app/api/`. The hot ones:
  - `chat/route.ts` — POST, validates with zod, returns SSE stream
  - `chat/stream.ts` — TTFB optimization: returns stream in one microtask, all auth/model/cache/agent work runs **after** the stream is open
  - `search/route.ts` — programmatic `POST /api/search` (see `docs/API/SEARCH.md`)
  - `providers/`, `chats/`, `discover/`, `uploads/`, `multimodal/`, `tts/`, `stt/`, `shares/`, `feedback/`, `auth/`, `setup/`, `reconnect/`
- **Agents** in `src/lib/agents/`:
  - `search/` — `classifier.ts` → `researcher/` (plan/registry/actions pattern, see `actions/index.ts`) + `widgets/` (weather, stocks, calculation). Stream timeouts in `index.ts`: 60s first chunk, 30s idle, 5min total. Writer prompt capped at 8 results.
  - `media/`, `multimodal/`, `suggestions/`, `learn/`
- **Models** in `src/lib/models/`. Provider adapters under `providers/` (anthropic, gemini, groq, lemonade, lmstudio, ollama, openai, openrouter, transformers). `registry.ts` is the entry.
- **Discover feed** is its own subsystem in `src/lib/discover/` — hybrid **BM25 + BGE-M3 cosine** (weight 0.3), optional cross-encoder rerank. See `docs/architecture/PHASE-6-CI-AND-MULTILINGUAL.md` for the eval story.
- **Path alias:** `@/*` → `src/*` (TS + Vitest both configured).

End-to-end request flow: see `docs/architecture/WORKING.md` (1 page) and `docs/architecture/README.md` (1 page). Read those two before touching the search pipeline.

## Two databases — easy to confuse

Bokari uses **both** a local SQLite file and Supabase Postgres. Don't mix them up.

| Concern | Storage | Path / config |
|---|---|---|
| Discover articles, sqlite cache, semantic cache, learn mode | **Local SQLite (sql.js, in-memory + exported)** | `${DATA_DIR}/data/db.sqlite` (default `process.cwd()`); schema in `src/lib/db/schema.ts`; migrations from `drizzle/` auto-applied on first use (see `src/lib/db/sqlite.ts`) |
| Users, chats, messages, feedback, uploads, shares, phone OTPs | **Supabase Postgres + Auth** | URL/keys in `.env.local`; migrations in `supabase/migrations/` (apply via `/setup` or `scripts/apply-migrations.js`) |

- `drizzle/` and `supabase/migrations/` are **parallel** sources. The app auto-runs `drizzle/*.sql` against the local SQLite on boot; `supabase/migrations/*.sql` is a hand/manual process.
- `drizzle.config.ts` is for **generating new Drizzle migrations** (not used at runtime). Don't run `drizzle-kit` unless adding a SQLite schema change.
- The `data/` directory in the repo is **dev-only**. `data/db.sqlite` is gitignored, `data/config.json` is committed. The Docker `bokari-data` volume mounts over `/home/bokari/data` — see `entrypoint.sh`.

## Tests

- Runner: Vitest, **node** env, **single-fork** pool, 15s default timeout (`vitest.config.ts`).
- Location: `tests/**/*.test.{ts,tsx}`.
- Setup file `tests/setup.ts` redirects `DATA_DIR` to a per-run tmpdir and stubs Supabase / Kapso / Meta env vars — tests never touch the real DB or network. Add new required envs to `tests/setup.ts`.
- LLM/SSE/DB-touching code is testable without API keys; the eval suite is the one that needs `OPENROUTER_API_KEY` (in live mode only).
- Vitest only — there is no Jest config. Don't add one.

## CI / release pipeline

- **`.github/workflows/retrieval-regression.yml`** — runs `npx tsx scripts/check-retrieval.ts --precomputed` on PRs that touch `src/lib/discover/**`, `src/lib/eval/**`, `src/lib/ai/**`, the eval scripts, or the baseline files. Fails on >0.02 drop in NDCG@10, MRR, or hit-rate@10. To intentionally improve the baseline: run `npm run eval:update-baseline` and commit `docs/eval/baseline.json` (and `docs/eval/query-embeddings.json` if vectors changed).
- **`.github/workflows/docker-build.yaml`** — multi-arch buildx (amd64 + arm64) on push to `master` / `canary` and on `release`. Two image variants: `Dockerfile` (full, bundles SearXNG + Python) and `Dockerfile.slim` (Node only, expects external SearXNG via `SEARXNG_API_URL`). Pushes to `dickenai/bokari`.
- Branches that trigger Docker builds: `master`, `canary`. Releases via GitHub releases.

## Docker notes

- `Dockerfile` clones and pip-installs SearXNG into a venv, runs it on `:8080` as a non-root user via `entrypoint.sh`, then execs the standalone Next.js server on `:3000`.
- `Dockerfile.slim` skips SearXNG entirely; set `SEARXNG_API_URL` at runtime.
- `next.config.mjs` has `output: 'standalone'` and explicit `outputFileTracingIncludes` for `@napi-rs/canvas` (linux-x64 gnu+musl). Don't remove — image rendering of multimodal blocks depends on it. `serverExternalPackages: ['pdf-parse', 'sql.js']` is also load-bearing.
- Health: `http://localhost:3000` (app) + `http://localhost:8080` (SearXNG, full image only).

## Repo conventions

- **Commits:** Conventional Commits (`feat:`, `fix:`, `docs:`, etc.) per `CONTRIBUTING.md`.
- **Language:** code/commits/identifiers in English; UI strings in French.
- **Formatting:** Prettier (`.prettierrc.js`) — `npm run format:write` before committing.
- **Tailwind:** shadcn `base-nova` style, no prefix, `lucide` icons. Tokens in `tailwind.config.ts` under `bokari-{50..900}` and `sand-{100..600}`.
- **shadcn skill** is bundled at `.agents/skills/shadcn/SKILL.md` — use it before adding or changing UI primitives.
- **`.claude/` is gitignored** (per `.gitignore` line 7) — local agent memory, don't commit.
- **No `opencode.json`** — OpenCode runs on defaults. Add one only if you need repo-local instructions to be picked up automatically.

## Things that will trip you up

- The `dev` and `build` scripts force `--webpack`. If you bypass npm (`npx next dev`) you'll get Turbopack by default in Next 16 and behavior will diverge.
- `data/db.sqlite` exists locally and **is** gitignored (via the `db.sqlite` rule), but `data/config.json` is **not**. Don't blindly `git add data/`.
- The two migration folders are not interchangeable. A change to one DB needs the matching migration file in its own folder.
- `src/lib/search.ts` boosts African news domains in ranking; `src/lib/searxng.ts` is the SearXNG adapter. Read both before "improving" search.
- `src/lib/agents/search/index.ts` has three hard-coded timeout constants (`LLM_FIRST_CHUNK_MS`, `LLM_IDLE_MS`, `LLM_TOTAL_MS`) and `MAX_WRITER_RESULTS`. These exist because of the "12-20 message slowdown" bug — see `docs/bugs/2026-06-02-bokari-12-20-slowdown.md` for the postmortem. Don't remove the caps.
- Public share links live at `/p/[slug]`; the public component tree is under `src/components/Public/`. Shared content is read-only.

## Where to look first

- `README.md` (user-facing) + `docs/architecture/WORKING.md` (1-page flow)
- `docs/architecture/PHASE-6-CI-AND-MULTILINGUAL.md` — explains the eval gate and cosine weight tradeoff
- `docs/architecture/ADR/` — nine ADRs covering hybrid ranker, OSS AI infra, eval harness, multilingual CI, cosine-weight knob, feedback loop, cross-encoder rerank
- `CONTRIBUTING.md` — branch/commit conventions
- `docs/bugs/2026-06-02-bokari-12-20-slowdown.md` — read before changing chat/streaming
