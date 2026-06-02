# Phase 8 — User Feedback Loop (thumbs + comment + captured context)

## Goal

Close the loop between the user and the model.  Every Bokari response now
ships with 👍 / 👎 buttons and (on 👎) an optional one-line comment.  The
click captures the **full conversation context** (query, response, cited
sources, model metadata) in a self-contained row, ready to be exported
to a fine-tuning JSONL with one command.

This is the missing piece between Phase 5 (synthetic eval) and any
real-world fine-tuning: real graded relevance labels from real users.

## What's in the box

### 1. `public.feedback` table (Supabase)

- `rating`     `SMALLINT CHECK (rating IN (-1, 0, 1))`  -1=👎, 0=cleared, 1=👍
- `comment`    `TEXT`  optional free-text from the user
- `captured`   `JSONB`  self-contained snapshot: { query, response, sources, metadata }
- `message_id` indexed; upserts to a single row per (message_id, user_id)
- RLS: users see/edit only their own rows
- Anon-friendly: `user_id` is nullable, anon inserts are allowed at the API

Migration: `supabase/migrations/20260605_feedback.sql`.

### 2. POST /api/feedback

Thin route that:
- validates the payload with zod (rating, messageId, captured structure)
- attaches the auth user (nullable for anon)
- upserts (auth) or inserts (anon) into `public.feedback`
- handles "cleared" feedback by deleting the row (no tombstones)

Validation schema lives in the route file — Phase 8 keeps it close to
the I/O boundary rather than in a separate `lib/feedback/schema.ts`,
because there is exactly one consumer.

### 3. `Feedback.tsx` UI component

- Two icons: `ThumbsUp` / `ThumbsDown` from `lucide-react`
- 👆 click: submit immediately, no comment
- 👇 click: popover with optional comment textarea, max 2000 chars
- Both: click again to clear (toggle semantics)
- States: idle / pending (spinner) / submitted (filled)
- Popover closes on outside click or `Esc` (next iteration)

The component lives in the action bar next to `Copy` and TTS, in
`src/components/MessageActions/Feedback.tsx`.

### 4. Pure `buildCapturedContext` helper

In `src/lib/feedback/context.ts` — separated from the React component
so unit tests can import it without pulling in `useChat` (and the
supabase client transitively).

Captures:

| Field | Source |
| --- | --- |
| `query` | `section.message.query` |
| `response` | `section.parsedTextBlocks.join('\n\n')` |
| `sources[]` | every cited URL, with title, domain, and `bokari-discover` flag |
| `metadata.researchStepCount` | sub-steps in the research block |
| `metadata.sourceCount` | total cited sources (deduped by URL) |
| `metadata.bokariCitationCount` | sources from the Phase 4 citation engine |
| `metadata.hasBokariCitations` | boolean convenience |
| `metadata.chatProvider/Model` | from `useChat().chatModelProvider` |
| `metadata.embeddingProvider/Model` | from `useChat().embeddingModelProvider` |
| `metadata.optimizationMode` | `speed` / `balanced` / `quality` |
| `metadata.latencyMs` | `Date.now() - message.createdAt` once completed |
| `metadata.locale` | `navigator.language` |
| `metadata.userAgent` | `navigator.userAgent`, truncated to 256 chars |

### 5. JSONL export script

`scripts/export-feedback.ts` reads the table and writes one JSON
record per line, ready for OpenAI / Together / Axolotl / etc.

```bash
SUPABASE_SERVICE_ROLE_KEY=… npx tsx scripts/export-feedback.ts
npx tsx scripts/export-feedback.ts --positive          # 👍 only
npx tsx scripts/export-feedback.ts --negative          # 👎 only
npx tsx scripts/export-feedback.ts --with-comment      # any rating, comment != null
npx tsx scripts/export-feedback.ts --out=path.jsonl
```

npm aliases: `feedback:export`, `feedback:export:positive`,
`feedback:export:negative`.

## Tests

- 11 new tests in `tests/feedback/feedback.test.ts` (validator, context
  builder, exporter, rating normalization)
- Total: **253 / 253** pass (was 242)

## Files added / changed

| File | Why |
| --- | --- |
| `supabase/migrations/20260605_feedback.sql` | new table + RLS + indexes |
| `src/lib/types/feedback.ts` | `FeedbackPayload`, `CapturedContext`, `FeedbackMetadata` |
| `src/lib/types/window.ts` | extracted `Message`, `Widget`, `File`, `BaseMessage` from ChatWindow |
| `src/lib/types/section.ts` | extracted `Section` from useChat (test isolation) |
| `src/lib/feedback/context.ts` | pure `buildCapturedContext` |
| `src/app/api/feedback/route.ts` | POST endpoint, zod-validated, upsert/insert |
| `src/components/MessageActions/Feedback.tsx` | UI thumbs + comment popover |
| `src/components/MessageBox.tsx` | wire `<Feedback>` into the action bar |
| `src/components/ChatWindow.tsx` | re-export types from `lib/types/window` |
| `src/lib/hooks/useChat.tsx` | import `Section` from new clean location |
| `scripts/export-feedback.ts` | JSONL export with filters |
| `tests/feedback/feedback.test.ts` | 11 unit tests |
| `package.json` | `feedback:export*` scripts |
| `docs/architecture/PHASE-8-FEEDBACK.md` | this doc |
| `docs/architecture/ADR/0008-user-feedback-loop.md` | the decision record |

## How to apply the migration

1. Open the Supabase dashboard SQL editor
   (https://supabase.com/dashboard/project/urwdrdobbvkenztuhcgx/sql).
2. Paste `supabase/migrations/20260605_feedback.sql`.
3. Run.

The migration is idempotent (`IF NOT EXISTS` everywhere).

## How to verify in production

1. Open any chat in the running dev server.
2. After a response, click 👍 — you should see it fill in green.
3. Click 👎 — comment popover should appear; submit with a comment.
4. Open the Supabase dashboard → `feedback` table → row should be there
   with `rating`, `comment`, and the full `captured` JSONB blob.
5. Run `npx tsx scripts/export-feedback.ts --with-comment` and
   inspect the resulting `data/feedback.jsonl` — one line per record,
   flat structure, fine-tuning-ready.

## Re-evaluation triggers

Re-evaluate the design when:
- we collect **1k+** feedback rows — that's enough to start building
  a human-rated eval set that supplements the synthetic `deriveRelevance`
- the corpus crosses **5k articles** and BM25 ties become common —
  feedback shows up as ground truth for the ranker
- we ship a fine-tuning pipeline (Phase 13+) — the export script
  becomes a primary input
- a user reports a privacy concern — consider adding "delete my
  feedback" to the account settings
