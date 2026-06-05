import { describe, it, expect, beforeEach } from 'vitest';
import {
  createDeck,
  listDecks,
  getDueCards,
  persistReview,
  resetLearnStoreCache,
} from '@/lib/learn/decks';

// Default backend = sqlite (tmpdir DB via tests/setup). Unique userIds/queries
// per test avoid cross-test contamination in the shared run DB.
beforeEach(() => resetLearnStoreCache());

describe('learn/decks — persistence (sqlite default)', () => {
  it('createDeck is idempotent on (userId, sourceQuery) — no duplicate cards', async () => {
    const u = 'u-idem';
    const sourceQuery = 'qu est-ce que la photosynthese';
    const first = await createDeck(u, {
      title: 'Photosynthèse',
      sourceQuery,
      cards: [
        { front: 'Définition ?', back: 'Conversion lumière → énergie' },
        { front: 'Où ?', back: 'Dans les chloroplastes' },
      ],
    });
    expect(first.created).toBe(true);
    expect(first.deck.cardCount).toBe(2);

    const second = await createDeck(u, {
      title: 'Photosynthèse',
      sourceQuery,
      cards: [{ front: 'X', back: 'Y' }],
    });
    expect(second.created).toBe(false);
    expect(second.deck.id).toBe(first.deck.id);

    const decks = await listDecks(u);
    expect(decks).toHaveLength(1);
    expect(decks[0]!.cardCount).toBe(2); // still 2 — the second save added nothing
  });

  it('new cards are immediately due; grading reschedules them out of the queue', async () => {
    const u = 'u-due';
    const now = new Date('2026-06-05T10:00:00.000Z');
    await createDeck(
      u,
      {
        title: 'T',
        sourceQuery: 'q-due',
        cards: [
          { front: 'a', back: 'b' },
          { front: 'c', back: 'd' },
        ],
      },
      now,
    );

    const due = await getDueCards(u, now);
    expect(due).toHaveLength(2);

    const review = await persistReview(u, due[0]!.id, 'good', now);
    expect(review).not.toBeNull();
    expect(review!.card.repetitions).toBe(1);
    expect(new Date(review!.card.dueAt).getTime()).toBeGreaterThan(now.getTime());

    const dueAfter = await getDueCards(u, now);
    expect(dueAfter).toHaveLength(1); // the reviewed card left the queue
  });

  it('persistReview returns null for a card the user does not own', async () => {
    const now = new Date('2026-06-05T10:00:00.000Z');
    await createDeck(
      'owner',
      { title: 'T', sourceQuery: 'q-own', cards: [{ front: 'a', back: 'b' }] },
      now,
    );
    const due = await getDueCards('owner', now);
    expect(due).toHaveLength(1);
    expect(await persistReview('intruder', due[0]!.id, 'good', now)).toBeNull();
  });
});
