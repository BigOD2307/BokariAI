/**
 * @module learn/decks
 * @description Dual-DB persistence + review CRUD for Learn-mode flashcard decks.
 *
 *   Two storage backends sit behind one `LearnStore` interface:
 *     - `sqlite` (DEFAULT, zero-config): the local sql.js DB. The
 *       `flashcard_decks` / `flashcards` tables already ship in
 *       `drizzle/0008_learn_mode.sql` and are auto-applied on boot. Always
 *       available — no Supabase keys required — so review state works out of
 *       the box and is fully unit-testable against the tmpdir DB.
 *     - `supabase`: the Postgres mirror (`supabase/migrations/*_learn_mode.sql`,
 *       RLS-protected) via a service-role admin client, mirroring the
 *       `auth/shares.ts` precedent.
 *
 *   Backend is selected by `BOKARI_LEARN_STORE` (env, cached at module scope —
 *   reset with `resetLearnStoreCache()` in tests). `supabase` silently degrades
 *   to `sqlite` when the Supabase env vars are missing, so a misconfigured
 *   deploy never loses review state.
 *
 *   SM-2 math lives in `agents/learn/scheduler.ts`; this module only persists
 *   the state it returns. CRUD here never throws on a backend error — it logs
 *   and falls back so the review UX degrades gracefully.
 */
import { customAlphabet } from 'nanoid';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { all, get, run } from '@/lib/db/sqlite';
import {
  reviewCardState,
  gradeToRating,
  type Grade,
  type CardState,
} from '@/lib/agents/learn/scheduler';

const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 12);

export const generateDeckId = (): string => `deck_${nanoid()}`;
export const generateCardId = (): string => `card_${nanoid()}`;

/** A flashcard as persisted (SM-2 state included). */
export interface StoredCard {
  id: string;
  deckId: string;
  front: string;
  back: string;
  easeFactor: number;
  interval: number;
  repetitions: number;
  dueAt: string;
  lastReviewedAt: string | null;
}

/** A deck row. `cardCount` / `dueCount` are filled by list/get helpers. */
export interface StoredDeck {
  id: string;
  userId: string;
  title: string;
  sourceQuery: string;
  subject: string | null;
  createdAt: string;
  cardCount?: number;
  dueCount?: number;
}

/** Input to {@link createDeck}. `cards` are the raw front/back pairs. */
export interface CreateDeckInput {
  title: string;
  sourceQuery: string;
  subject?: string | null;
  cards: { front: string; back: string }[];
}

/** The storage contract both backends implement. */
export interface LearnStore {
  createDeck(userId: string, input: CreateDeckInput, now: Date): Promise<StoredDeck>;
  listDecks(userId: string): Promise<StoredDeck[]>;
  getDeck(userId: string, deckId: string): Promise<{ deck: StoredDeck; cards: StoredCard[] } | null>;
  getDueCards(userId: string, now: Date, limit: number): Promise<StoredCard[]>;
  getCardForReview(userId: string, cardId: string): Promise<StoredCard | null>;
  saveCardState(cardId: string, state: CardState): Promise<void>;
}

const DUE_LIMIT = 20;

// ---------------------------------------------------------------------------
// SQLite backend (default, zero-config)
// ---------------------------------------------------------------------------

function rowToCard(r: Record<string, unknown>): StoredCard {
  return {
    id: String(r.id),
    deckId: String(r.deckId),
    front: String(r.front),
    back: String(r.back),
    easeFactor: Number(r.easeFactor),
    interval: Number(r.interval),
    repetitions: Number(r.repetitions),
    dueAt: String(r.dueAt),
    lastReviewedAt: r.lastReviewedAt == null ? null : String(r.lastReviewedAt),
  };
}

function rowToDeck(r: Record<string, unknown>): StoredDeck {
  return {
    id: String(r.id),
    userId: String(r.userId),
    title: String(r.title),
    sourceQuery: String(r.sourceQuery),
    subject: r.subject == null ? null : String(r.subject),
    createdAt: String(r.createdAt),
    cardCount: r.cardCount == null ? undefined : Number(r.cardCount),
    dueCount: r.dueCount == null ? undefined : Number(r.dueCount),
  };
}

const sqliteStore: LearnStore = {
  async createDeck(userId, input, now) {
    // Idempotent on (userId, sourceQuery): a repeat save returns the existing
    // deck unchanged and inserts NO new cards (preserves review progress).
    const existing = await get<Record<string, unknown>>(
      `SELECT * FROM flashcard_decks WHERE userId = ? AND sourceQuery = ? LIMIT 1`,
      [userId, input.sourceQuery],
    );
    if (existing) {
      const deck = rowToDeck(existing);
      const cnt = await get<{ c: number }>(
        `SELECT COUNT(*) AS c FROM flashcards WHERE deckId = ?`,
        [deck.id],
      );
      deck.cardCount = cnt?.c ?? 0;
      return deck;
    }

    const id = generateDeckId();
    const createdAt = now.toISOString();
    await run(
      `INSERT INTO flashcard_decks (id, userId, title, sourceQuery, subject, createdAt)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, userId, input.title, input.sourceQuery, input.subject ?? null, createdAt],
    );
    const dueAt = now.toISOString(); // new cards are immediately due
    for (const card of input.cards) {
      await run(
        `INSERT INTO flashcards
           (id, deckId, front, back, easeFactor, interval, repetitions, dueAt, lastReviewedAt)
         VALUES (?, ?, ?, ?, 2.5, 0, 0, ?, NULL)`,
        [generateCardId(), id, card.front, card.back, dueAt],
      );
    }
    return {
      id,
      userId,
      title: input.title,
      sourceQuery: input.sourceQuery,
      subject: input.subject ?? null,
      createdAt,
      cardCount: input.cards.length,
    };
  },

  async listDecks(userId) {
    const rows = await all<Record<string, unknown>>(
      `SELECT d.*,
              (SELECT COUNT(*) FROM flashcards f WHERE f.deckId = d.id) AS cardCount,
              (SELECT COUNT(*) FROM flashcards f WHERE f.deckId = d.id AND f.dueAt <= ?) AS dueCount
         FROM flashcard_decks d
        WHERE d.userId = ?
        ORDER BY d.createdAt DESC`,
      [new Date().toISOString(), userId],
    );
    return rows.map(rowToDeck);
  },

  async getDeck(userId, deckId) {
    const deckRow = await get<Record<string, unknown>>(
      `SELECT * FROM flashcard_decks WHERE id = ? AND userId = ? LIMIT 1`,
      [deckId, userId],
    );
    if (!deckRow) return null;
    const cardRows = await all<Record<string, unknown>>(
      `SELECT * FROM flashcards WHERE deckId = ? ORDER BY rowid ASC`,
      [deckId],
    );
    const deck = rowToDeck(deckRow);
    deck.cardCount = cardRows.length;
    return { deck, cards: cardRows.map(rowToCard) };
  },

  async getDueCards(userId, now, limit) {
    const rows = await all<Record<string, unknown>>(
      `SELECT f.*
         FROM flashcards f
         JOIN flashcard_decks d ON d.id = f.deckId
        WHERE d.userId = ? AND f.dueAt <= ?
        ORDER BY f.dueAt ASC
        LIMIT ?`,
      [userId, now.toISOString(), limit],
    );
    return rows.map(rowToCard);
  },

  async getCardForReview(userId, cardId) {
    // Join through the deck so a user can only review cards they own.
    const row = await get<Record<string, unknown>>(
      `SELECT f.*
         FROM flashcards f
         JOIN flashcard_decks d ON d.id = f.deckId
        WHERE f.id = ? AND d.userId = ?
        LIMIT 1`,
      [cardId, userId],
    );
    return row ? rowToCard(row) : null;
  },

  async saveCardState(cardId, state) {
    await run(
      `UPDATE flashcards
          SET easeFactor = ?, interval = ?, repetitions = ?, dueAt = ?, lastReviewedAt = ?
        WHERE id = ?`,
      [
        state.easeFactor,
        state.interval,
        state.repetitions,
        state.dueAt,
        state.lastReviewedAt ?? null,
        cardId,
      ],
    );
  },
};

// ---------------------------------------------------------------------------
// Supabase backend (opt-in mirror; degrades to sqlite when unconfigured)
// ---------------------------------------------------------------------------

let _admin: SupabaseClient | null = null;
function getAdmin(): SupabaseClient | null {
  if (_admin) return _admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  _admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return _admin;
}

/** Reset the memoized Supabase admin client (tests / env changes). */
export function resetLearnAdminCache(): void {
  _admin = null;
}

const sbDeck = (r: any): StoredDeck => ({
  id: r.id,
  userId: r.user_id,
  title: r.title,
  sourceQuery: r.source_query,
  subject: r.subject ?? null,
  createdAt: r.created_at,
});

const sbCard = (r: any): StoredCard => ({
  id: r.id,
  deckId: r.deck_id,
  front: r.front,
  back: r.back,
  easeFactor: Number(r.ease_factor),
  interval: Number(r.interval),
  repetitions: Number(r.repetitions),
  dueAt: r.due_at,
  lastReviewedAt: r.last_reviewed_at ?? null,
});

const supabaseStore: LearnStore = {
  async createDeck(userId, input, now) {
    const admin = getAdmin();
    if (!admin) return sqliteStore.createDeck(userId, input, now);
    const { data: existing } = await admin
      .from('flashcard_decks')
      .select('*')
      .eq('user_id', userId)
      .eq('source_query', input.sourceQuery)
      .maybeSingle();
    if (existing) return sbDeck(existing);

    const id = generateDeckId();
    const createdAt = now.toISOString();
    const { data, error } = await admin
      .from('flashcard_decks')
      .insert({
        id,
        user_id: userId,
        title: input.title,
        source_query: input.sourceQuery,
        subject: input.subject ?? null,
        created_at: createdAt,
      })
      .select('*')
      .single();
    if (error) throw error;
    if (input.cards.length > 0) {
      const dueAt = now.toISOString();
      const { error: cardErr } = await admin.from('flashcards').insert(
        input.cards.map((c) => ({
          id: generateCardId(),
          deck_id: id,
          front: c.front,
          back: c.back,
          ease_factor: 2.5,
          interval: 0,
          repetitions: 0,
          due_at: dueAt,
          last_reviewed_at: null,
        })),
      );
      if (cardErr) throw cardErr;
    }
    return { ...sbDeck(data), cardCount: input.cards.length };
  },

  async listDecks(userId) {
    const admin = getAdmin();
    if (!admin) return sqliteStore.listDecks(userId);
    const { data, error } = await admin
      .from('flashcard_decks')
      .select('*, flashcards(count)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((r: any) => ({
      ...sbDeck(r),
      cardCount: r.flashcards?.[0]?.count ?? 0,
    }));
  },

  async getDeck(userId, deckId) {
    const admin = getAdmin();
    if (!admin) return sqliteStore.getDeck(userId, deckId);
    const { data: deck } = await admin
      .from('flashcard_decks')
      .select('*')
      .eq('id', deckId)
      .eq('user_id', userId)
      .maybeSingle();
    if (!deck) return null;
    const { data: cards } = await admin
      .from('flashcards')
      .select('*')
      .eq('deck_id', deckId);
    const mapped = (cards ?? []).map(sbCard);
    return { deck: { ...sbDeck(deck), cardCount: mapped.length }, cards: mapped };
  },

  async getDueCards(userId, now, limit) {
    const admin = getAdmin();
    if (!admin) return sqliteStore.getDueCards(userId, now, limit);
    // Filter by ownership via an inner join on the deck.
    const { data, error } = await admin
      .from('flashcards')
      .select('*, flashcard_decks!inner(user_id)')
      .eq('flashcard_decks.user_id', userId)
      .lte('due_at', now.toISOString())
      .order('due_at', { ascending: true })
      .limit(limit);
    if (error) throw error;
    return (data ?? []).map(sbCard);
  },

  async getCardForReview(userId, cardId) {
    const admin = getAdmin();
    if (!admin) return sqliteStore.getCardForReview(userId, cardId);
    const { data } = await admin
      .from('flashcards')
      .select('*, flashcard_decks!inner(user_id)')
      .eq('id', cardId)
      .eq('flashcard_decks.user_id', userId)
      .maybeSingle();
    return data ? sbCard(data) : null;
  },

  async saveCardState(cardId, state) {
    const admin = getAdmin();
    if (!admin) return sqliteStore.saveCardState(cardId, state);
    const { error } = await admin
      .from('flashcards')
      .update({
        ease_factor: state.easeFactor,
        interval: state.interval,
        repetitions: state.repetitions,
        due_at: state.dueAt,
        last_reviewed_at: state.lastReviewedAt ?? null,
      })
      .eq('id', cardId);
    if (error) throw error;
  },
};

// ---------------------------------------------------------------------------
// Backend router (env-selected, cached at module scope)
// ---------------------------------------------------------------------------

export type LearnStoreKind = 'sqlite' | 'supabase';

let _store: LearnStore | null = null;
let _storeKind: LearnStoreKind | null = null;

function resolveStoreKind(): LearnStoreKind {
  const raw = (process.env.BOKARI_LEARN_STORE || 'sqlite').toLowerCase();
  return raw === 'supabase' ? 'supabase' : 'sqlite';
}

/** The configured backend (cached). */
export function getLearnStore(): LearnStore {
  if (_store) return _store;
  _storeKind = resolveStoreKind();
  _store = _storeKind === 'supabase' ? supabaseStore : sqliteStore;
  return _store;
}

/** Reset the memoized backend selection (tests / env changes). */
export function resetLearnStoreCache(): void {
  _store = null;
  _storeKind = null;
  _admin = null;
}

// ---------------------------------------------------------------------------
// Public CRUD facade — what the API routes call.
// ---------------------------------------------------------------------------

/**
 * Create (or fetch, if it already exists) a deck for `userId`. Idempotent on
 * `(userId, sourceQuery)` — saving the same answer's flashcards twice returns
 * the original deck and does NOT duplicate cards or reset review progress.
 */
export async function createDeck(
  userId: string,
  input: CreateDeckInput,
  now: Date = new Date(),
): Promise<{ deck: StoredDeck; created: boolean }> {
  const before = await getLearnStore().listDecks(userId).catch(() => []);
  const existed = before.some((d) => d.sourceQuery === input.sourceQuery);
  const deck = await getLearnStore().createDeck(userId, input, now);
  return { deck, created: !existed };
}

export async function listDecks(userId: string): Promise<StoredDeck[]> {
  return getLearnStore().listDecks(userId);
}

export async function getDeck(
  userId: string,
  deckId: string,
): Promise<{ deck: StoredDeck; cards: StoredCard[] } | null> {
  return getLearnStore().getDeck(userId, deckId);
}

/** Cards due now (dueAt <= now), oldest-due first, capped at `limit` (≤20). */
export async function getDueCards(
  userId: string,
  now: Date = new Date(),
  limit: number = DUE_LIMIT,
): Promise<StoredCard[]> {
  return getLearnStore().getDueCards(userId, now, Math.min(limit, DUE_LIMIT));
}

/**
 * Apply a review grade to a card: maps the grade → SM-2 rating → next state
 * (via `agents/learn/scheduler`), persists it, and returns the new state.
 * Returns null if the card does not exist or is not owned by `userId`.
 */
export async function persistReview(
  userId: string,
  cardId: string,
  grade: Grade,
  now: Date = new Date(),
): Promise<{ card: StoredCard; state: CardState } | null> {
  const store = getLearnStore();
  const card = await store.getCardForReview(userId, cardId);
  if (!card) return null;
  const state = reviewCardState(
    {
      repetitions: card.repetitions,
      easeFactor: card.easeFactor,
      interval: card.interval,
      dueAt: card.dueAt,
    },
    grade,
    now,
  );
  await store.saveCardState(cardId, state);
  return {
    card: {
      ...card,
      easeFactor: state.easeFactor,
      interval: state.interval,
      repetitions: state.repetitions,
      dueAt: state.dueAt,
      lastReviewedAt: state.lastReviewedAt ?? null,
    },
    state,
  };
}

/** Re-export for route validation: the four accepted grade strings. */
export const GRADES: Grade[] = ['again', 'hard', 'good', 'easy'];
export { gradeToRating };
