/**
 * Landing → chat attachment hand-off.
 *
 * The landing search box lets a visitor attach files BEFORE a chat exists. On
 * submit it stashes the converted Attachments here, then navigates (client-side)
 * to /c/<id>?q=…. Because the navigation is a client transition (no full reload),
 * this module-level store survives it. `sendMessage` then drains the store at
 * send time and merges the files into the first message — so nothing is lost and
 * there is no React state-timing race.
 */
import type { Attachment } from '@/lib/types/multimodal';

let pending: Attachment[] = [];

/** Stash attachments to carry into the next (landing-initiated) chat. */
export function setPendingLandingAttachments(attachments: Attachment[]): void {
  pending = attachments;
}

/** Drain the stash (returns and clears). Returns [] when there's nothing. */
export function takePendingLandingAttachments(): Attachment[] {
  const out = pending;
  pending = [];
  return out;
}

/**
 * Fresh-chat markers. The landing mints a chat id and navigates to /c/<id>?q=…
 * BEFORE that chat exists in the DB. We flag the id here (synchronously, no
 * searchParams-timing race) so `useChat` treats it as a brand-new chat —
 * skipping the load that would otherwise 404 and flash a "not found" page.
 */
const freshChats = new Set<string>();

/** Mark a just-minted chat id as fresh (called by the landing before nav). */
export function markFreshChat(id: string): void {
  freshChats.add(id);
}

/** True once (and clears) if the id was flagged fresh by the landing. */
export function consumeFreshChat(id: string): boolean {
  const had = freshChats.has(id);
  freshChats.delete(id);
  return had;
}

/**
 * Mint a fresh chat id (40-hex, same scheme as the landing composer), flag it
 * as fresh, and return it. Used by the "Nouveau fil" button + the new-thread
 * shortcut so they open an empty `/c/<id>` (with the sidebar + composer)
 * instead of bouncing to the marketing home.
 */
export function freshChatId(): string {
  const arr = new Uint8Array(20);
  globalThis.crypto.getRandomValues(arr);
  const id = Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
  markFreshChat(id);
  return id;
}

/**
 * The query typed on the landing, carried (race-free) into the chat so the
 * auto-send doesn't depend on `useSearchParams()` updating across the client
 * navigation — which can lag and leave the chat hanging on "loading".
 */
let pendingQuery: string | null = null;

export function setPendingLandingQuery(q: string): void {
  pendingQuery = q;
}

export function takePendingLandingQuery(): string | null {
  const out = pendingQuery;
  pendingQuery = null;
  return out;
}
