/**
 * @module utils/chatHistory
 * @description Truncation helpers for the chat-history ref sent to the
 * Bokari agent.
 *
 * The history is a `[role, content][]` tuple where role is 'human' or
 * 'assistant'.  Each *turn* is two entries (human + assistant).
 *
 * Why cap?
 *   The server passes the entire history into the writer LLM prompt.
 *   Unbounded, it grows linearly with chat length — at ~500 tokens per
 *   turn, 50 turns ≈ 25k tokens, and Groq Llama 70B starts to slow
 *   visibly.  We saw the symptom: Bokari becomes slow / unresponsive
 *   around turn 12-20.
 *
 *   Capping at 8 turns (= 16 entries, ~4k tokens) keeps the prompt
 *   tight while preserving recent context — sufficient for the agent
 *   to follow a thread.
 *
 *   The *display* history (Message[]) is untouched; this only affects
 *   what we ship to the server.
 *
 * @author Amadou — Dicken AI
 */

export const MAX_HISTORY_TURNS = 8;
export const MAX_HISTORY_ENTRIES = MAX_HISTORY_TURNS * 2;

/** Cap a chat-history tuple to the last N turns (N*2 entries).  Returns
 *  a new array — never mutates the input.  Safe for empty / short input. */
export function truncateHistory(
  history: readonly [string, string][],
  maxEntries: number = MAX_HISTORY_ENTRIES,
): [string, string][] {
  if (history.length <= maxEntries) return [...history];
  return history.slice(history.length - maxEntries);
}

/** Append a turn to the history and cap the result.  Use this instead
 *  of `chatHistory.current = [...chatHistory.current, t]` so the
 *  cap is enforced on every write. */
export function appendTurn(
  history: readonly [string, string][],
  turn: [string, string],
  maxEntries: number = MAX_HISTORY_ENTRIES,
): [string, string][] {
  const next = [...history, turn];
  if (next.length <= maxEntries) return next;
  return next.slice(next.length - maxEntries);
}
