# Performance Architecture — Sprint 3

**Status:** Sprint 3 (speed / performance) complete
**Goal:** Cut `/api/chat` TTFB from "model-load + first LLM chunk" to "next tick", and bound the LLM cost of repeat queries.

## Summary

| Stage                  | Before Sprint 3         | After Sprint 3                    |
| ---------------------- | ----------------------- | --------------------------------- |
| Client TTFB            | 1-3s cold start         | <50ms (queueMicrotask `open`)     |
| Repeat query           | full agent + search     | semantic cache hit, ~1ms          |
| OpenAI token cost      | full price on every hit | 50% discount on cached prefix     |
| Deep research (mode='quality') | 30-60s SSE stream held open | pollable async job (202 + GET)  |

## Components

### 1. Semantic cache (`src/lib/cache/`)

A SQLite-backed cache (`{DATA_DIR}/cache.sqlite`) that stores
the query embedding, the response text, and a TTL. Two queries
that *normalise* to the same hash (after lowercase, punctuation
strip, stop-word removal, token sort) hit the same row; two
queries whose embeddings are within 0.92 cosine hit the same
row via a linear scan in JS.

**Why not a vector index?** The table stays under ~5k rows in
practice. Linear scan over 5k × 1024-dim Float32 vectors is
<3ms p95 on a modern CPU. We swap to `sqlite-vss` or HNSW when
we exceed ~50k entries.

**Why BGE-M3 and not OpenAI embeddings?** BGE-M3 is MIT, cheap
(~$0.01/1M tokens), and multilingual — the same cache serves
French, English, Bambara queries identically.

**Knobs:**
- `COSINE_THRESHOLD = 0.92` — high enough to avoid cross-topic
  confusion, low enough to absorb word re-orderings.
- `DEFAULT_TTL_MS = 7 days` — covers the typical "I asked this
  yesterday" pattern.

### 2. Chat route refactor (`src/app/api/chat/route.ts`)

The previous route awaited `authClient.auth.getUser()` and
`registry.loadChatModel(...)` *before* returning the SSE
response. The new pattern:

```
1. Parse + validate body (sync)
2. Construct TransformStream, return Response
3. queueMicrotask → emit "open" event
4. void IIFE: auth, model load, cache lookup, agent kickoff
5. Writer shared across all async work
```

This is the pattern recommended for Next.js App Router SSE (see
issue #9965). The first byte hits the client in a single tick;
agent work continues in the background and pushes events to the
same writer.

**Safe-write guard:** `safeWrite(line)` catches the
"writer already closed" case (the client disconnected mid-stream)
and flips a `closed` flag so we stop trying.

**Cache wiring:**
- Before agent kickoff, look up the query in the semantic cache.
- On hit, emit a single `block` (text) + `researchComplete` +
  `messageEnd` and close the stream.  The user gets their answer
  in <50ms.
- On miss, after the agent's `end` event, assemble the text
  response and cache it for next time.

### 3. Provider prompt cache (`src/lib/models/providers/{openai,anthropic}/`)

`OpenAILLM.applyPromptCaching(messages)` converts the system
message and the last context message content from a string into
an array of parts with `cache_control: { type: 'ephemeral' }`.
The OpenAI SDK forwards the field as-is to the API, and OpenAI
honours the cache for 5-10 minutes.

**Why the system AND the last context?** The system prompt is
the expensive prefix (we ship a long writer prompt with examples,
citation rules, etc).  The last context message is what changes
turn-to-turn but has a high re-read rate (the same user often
asks 3-4 follow-ups in a row).  Caching both cuts the marginal
cost-per-1k-tokens by ~50% on the second turn onward.

**Anthropic:** the override is a passthrough for now — both
providers go through the OpenAI SDK.  The explicit override
means we can swap to Anthropic's native message shape later
without touching OpenAILLM.

### 4. Search agent progress events (`src/lib/agents/search/index.ts`)

The first event the client used to see was `block`, which
typically fired 200-800ms after the request — so the user sat
on a blank spinner with no feedback.

The new agent emits `analyzing` events at the start of each
major step:
- `init`        (right at the start, before DB upsert)
- `classifier`  (before the LLM classifier call)
- `widgets`     (before widget execution kicks off)
- `search`      (before the Researcher tool loop)
- `reading`     (after search, before waiting on results)
- `writing`     (after researchComplete, before the LLM writer)

The client (useChat.tsx) handles `analyzing` as a re-render
trigger.  Components that want to show "Analyse de votre
question…", "Recherche en cours…", etc. just read the latest
event.

### 5. Async background research (`src/lib/jobs/research.ts`,
   `src/app/api/research-async/route.ts`,
   `src/lib/agents/search/async.ts`)

Deep-research queries (mode='quality', 35 iterations × 3
queries) routinely take 30-60 seconds. Holding an SSE stream
open that long is hostile to mobile networks and to Next.js's
default 10s edge timeout.

The async path:
- `POST /api/research-async` → 202 + `{ jobId, status: 'pending' }`
- The actual work (model load + runAsyncResearch) runs in a
  void IIFE.
- `GET /api/research-async?jobId=…` polls for
  `{ status, progress, result, error }`.

The job store is module-scoped, capped at 100 entries, and
auto-pruned after 1h.  The GET endpoint is intentionally
unauthenticated — the 128-bit jobId is the bearer secret.

### 6. Observability (`src/lib/observability/ttfb.ts`)

A small in-memory timing store keyed by request id, with
percentile helpers (`getPercentiles('chat.first_block')` →
`{ p50, p95, p99, count }`).

Every chat stage calls `recordTiming(label, ms, meta?)` in
addition to `logStage(label, ms, meta?)`.  The `recordTiming`
call forwards to `logStage` for the console.warn line and also
stores the record in the LRU-capped map.

The client adds two complementary timings:
- `client.request_to_first_byte` — round-trip from
  `sendMessage` → first chunk over the SSE
- `client.send_total` — full `sendMessage` lifecycle

Together with the server-side stages, these let us answer
"time-to-first-byte" on both ends without a metrics backend.

## Bench

Run the micro-bench on demand:

```bash
npx tsx scripts/bench-cache.ts
```

Expected output (Windows, modern CPU, 2k queries):

```
Semantic cache micro-bench (N=2000)
─────────────────────────────────────────
Insert throughput : ~4000 rows/sec
Exact-hash lookup : p50≈0.1ms  p95≈0.2ms
Cosine scan       : p50≈1.8ms  p95≈2.7ms
```

Pass `--json` to get a machine-readable summary for CI.

## Future work

- **Vector index** when we exceed ~50k cached queries.
- **Per-user cache** so the same query asked by user A doesn't
  pollute user B's results.
- **Streaming cache hits** — for very long cached answers, write
  the text in chunks to mimic the live streaming feel.
- **LRU eviction** — right now we keep everything until TTL.
  Add a hard cap (e.g. 10k rows) with LRU eviction.
- **Cache-warming** at deploy time for the top-100 queries
  observed in the previous 7 days.
