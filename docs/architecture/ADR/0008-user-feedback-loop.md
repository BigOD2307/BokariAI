# ADR 0008 — User Feedback Loop (thumbs + captured context)

- **Status:** Accepted
- **Date:** 2026-06-02
- **Deciders:** Amadou (Dicken AI — Backend + AI/ML)
- **Supersedes:** none (extends Phase 5 synthetic eval)
- **Related:** ADR 0005 (eval harness), ADR 0006 (multilingual + CI gate), ADR 0007 (cosine weight + precomputed CI)

## Context

Phases 5–7 built a synthetic eval harness.  The `deriveRelevance`
grader in `src/lib/eval/dataset.ts` is a token-overlap proxy for human
judgment — it works for the CI gate (it catches regressions) but it
never sees what *real* users think of *real* responses.

To close the loop we need a way for users to tell us when Bokari
missed the mark, and to capture enough context that the feedback row
is self-contained — i.e. it can be dropped into a fine-tuning set
without joining any other table.

## Decision

Add a `public.feedback` table, a `POST /api/feedback` route, a
thumbs-up/down UI component in the assistant action bar, and a JSONL
export script.

### 1. `public.feedback` schema

```sql
CREATE TABLE public.feedback (
  id          BIGSERIAL PRIMARY KEY,
  message_id  TEXT NOT NULL,
  chat_id     TEXT,
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  rating      SMALLINT NOT NULL CHECK (rating IN (-1, 0, 1)),
  comment     TEXT,
  captured    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

- **`rating` ∈ {-1, 0, 1}** — clear semantics, no enum creep.
  `0` means "the user cleared their previous feedback" and results in
  a row delete (no tombstones).
- **`captured` is JSONB, not a normalised join** — this is the
  design choice that lets the export script stay tiny.  A normalised
  schema (separate `feedback_sources`, `feedback_metadata` tables) is
  cleaner for queries but **a feedback row is write-once, read-many**
  — we never need to query "all feedbacks where the response was
  >500 chars" or anything relational.  We only ever read by
  `message_id`, `user_id`, or `created_at`.  JSONB wins.
- **`message_id` is the join key, not a chat-scoped id** — the user
  may reload a chat and we want the feedback to follow the message,
  not the chat.
- **RLS: `auth.uid() = user_id`** — direct browser reads are user-
  scoped.  The anon write path goes through the service-role client
  on the server, which bypasses RLS.  This is the same pattern as
  the `messages` table.

### 2. POST /api/feedback route

Thin.  Validates the body with zod, attaches the auth user if
present, then upserts (auth) or inserts (anon).  `rating: 0`
deletes the row.

```ts
POST /api/feedback
{ "messageId": "abc", "rating": 1, "comment": null, "captured": { ... } }
```

We chose zod (vs a hand-rolled validator) because the schema has
nested structure (`captured.sources[].url`, `captured.metadata.*`)
and zod's `.refine()` gives us clean error messages.

### 3. UI: thumbs + popover

- 👍 : submit immediately, no comment
- 👎 : open a small popover (max 320×auto) with an optional comment
  textarea, max 2000 chars
- Toggle: clicking the same thumb again clears the rating
- States: idle / pending (spinner) / submitted (filled icon)
- Popover closes on outside click

The popover uses framer-motion (already a dep) for the enter/exit
animation.  No new dep added.

The component lives in the existing action bar in `MessageBox.tsx`,
next to `Copy` and TTS.  It uses the same `text-black/35` hover
style as the other actions so the bar stays visually balanced.

### 4. Pure `buildCapturedContext` helper

The thing that builds the `captured` payload is **pure** and lives
in `src/lib/feedback/context.ts`.  The React component imports it.

This separation was forced by the test suite: importing the React
component transitively pulls in `useChat`, which transitively pulls
in the Supabase client, which throws on missing env vars.  By
keeping the builder pure, the tests can import it directly.  A
nice side effect is that future tooling (e.g. a CLI that pre-fills
captured context) can also import it.

### 5. JSONL export script

`scripts/export-feedback.ts` reads the table and writes a
fine-tuning-ready file:

```bash
npx tsx scripts/export-feedback.ts --positive --out=pos.jsonl
npx tsx scripts/export-feedback.ts --with-comment
```

Output schema (one record per line):

```json
{
  "messageId": "abc",
  "chatId": "xyz",
  "userId": "uuid",
  "rating": 1,
  "comment": "excellent",
  "createdAt": "2026-06-02T...",
  "query": "...",
  "response": "...",
  "sources": [{ "url": "...", "title": "...", "domain": "...", "source": "bokari-discover" }],
  "metadata": { "chatProvider": "groq", "chatModel": "llama-3.3-70b-versatile", ... }
}
```

## Consequences

Positive:
- **Real human labels** — every feedback row is a graded query
  with a known-good-or-bad response.  We can use 👍 rows to
  augment the synthetic eval (treat as `rel=3`) and 👎 rows as
  counter-examples.
- **Self-contained** — the row carries its own context, so the
  export script is a 100-line `for` loop.  No joins, no ETL.
- **Free fine-tuning data** — `feedback:export:positive` produces
  a JSONL ready for OpenAI / Together / Axolotl.  When we ship
  a fine-tuning pipeline (Phase 13+), the data is already in
  shape.
- **Privacy-aware** — `user_id` is nullable, RLS keeps direct
  browser reads user-scoped, and the export script uses the
  service-role client (no PII leakage to the user's own session).
- **Latency-zero** — clicking 👍 does not block the UI on the
  network round trip.  The state changes optimistically only
  after the server returns 200.

Negative:
- **Low signal at launch** — until we have 1k+ rows, the
  feedback data is too sparse to drive any model retraining.
  We accept this; the value is in the *infrastructure*, not
  the immediate training set.
- **User-id-less duplicates** — anon rows with `user_id IS NULL`
  are not deduplicated by the unique index (the index treats
  NULL as distinct).  This is intentional (we don't want to
  drop a 👍 from a different anon user) but it does mean we
  could accumulate duplicate rows for the same `message_id`.
  Rate-limit at the edge if abuse becomes a problem.
- **Latency is client-estimated** — `latencyMs` is `Date.now() -
  message.createdAt` measured in the browser.  It includes the
  network round trip from Vercel's edge, so it's not the pure
  server-side LLM latency.  For server-side observability we
  should still log from the API route; this is a *user-experience*
  metric, not a server SLO.
- **Comment is opt-in, not required** — we tried to keep friction
  low.  A 👎 with a comment is 10× more useful than a 👎 alone,
  but forcing the comment would tank the click rate.  A small
  prompt like "Qu'est-ce qui n'allait pas ?" + a placeholder
  hint nudges users toward commenting without requiring it.

## Alternatives considered

- **Three-state rating (👎, neutral, 👍)** — rejected.  Noisy.
  Users don't differentiate between "neutral" and "didn't care",
  and the signal is too weak to be actionable.  Binary is fine.
- **Star rating (1-5)** — rejected.  Perplexity uses thumbs;
  users are familiar with it.  Star ratings need a UI library
  and a perceptual anchor (is 3 good? bad?) that varies by user.
- **Store feedback in a separate `pgvector` index for similarity
  search** — rejected.  Premature.  We just want to read them
  back as a flat list.  Add an index when we have a real query
  pattern (e.g. "find feedback rows that look like this one").
- **Use the chat hook to also push feedback via WebSocket** —
  rejected.  REST is fine for low-frequency write events.  WS
  is for streaming and presence, not for "user clicked a button
  once per response".
- **Auto-ingest feedback into the eval dataset as
  `deriveRelevance` `mustMatch` rows** — deferred to Phase 11.
  The infrastructure is in place (we can re-derive the binary
  label from a 👍 response, or use the absence of a 👎 as a
  weak positive).  We just need a few hundred rows to do it
  safely without poisoning the eval.

## Implementation

Files added/changed in this phase:
- `supabase/migrations/20260605_feedback.sql` (new)
- `src/lib/types/feedback.ts` (new)
- `src/lib/types/window.ts` (new — extracted from ChatWindow)
- `src/lib/types/section.ts` (new — extracted from useChat)
- `src/lib/feedback/context.ts` (new — pure builder)
- `src/app/api/feedback/route.ts` (new — POST route)
- `src/components/MessageActions/Feedback.tsx` (new — UI)
- `src/components/MessageBox.tsx` (wire into action bar)
- `src/components/ChatWindow.tsx` (re-export types)
- `src/lib/hooks/useChat.tsx` (use clean type imports)
- `scripts/export-feedback.ts` (new — JSONL export)
- `tests/feedback/feedback.test.ts` (new — 11 tests)
- `package.json` (`feedback:export*` scripts)

Tests: **253 / 253 pass** (was 242).

## Review

Re-evaluate when:
- 1k+ feedback rows collected — start building a human-rated
  eval set that supplements the synthetic grader
- corpus crosses 5k articles — feedback is a meaningful
  ground truth for the ranker
- fine-tuning pipeline ships (Phase 13+) — the export
  becomes a primary input
- user reports a privacy concern — add "delete my feedback"
  to the account settings
- abuse appears in anon feedback — add edge rate-limiting
