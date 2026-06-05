/**
 * @module agents/learn/scheduler
 * @description SM-2 spaced-repetition adapter. Bridges a stored flashcard row
 *   (repetitions / easeFactor / interval / dueAt — see flashcards table in
 *   db/schema.ts) to the @open-spaced-repetition/sm-2 Scheduler and back.
 *
 *   The four review buttons map to SM-2 ratings: SM-2 treats rating >= 3 as a
 *   pass, so only "Encore" (Again) fails and resets the card.
 */
import { Card, Scheduler } from '@open-spaced-repetition/sm-2';

export type Grade = 'again' | 'hard' | 'good' | 'easy';

/** Map a review button to an SM-2 quality rating (0–5). Pass boundary is 3. */
export function gradeToRating(grade: Grade): number {
  switch (grade) {
    case 'again':
      return 2; // < 3 → fail, repetitions reset
    case 'hard':
      return 3;
    case 'good':
      return 4;
    case 'easy':
      return 5;
    default:
      return 3;
  }
}

/** The SM-2 state persisted on a flashcard row. */
export interface CardState {
  repetitions: number;
  easeFactor: number;
  /** Inter-repetition interval in days. */
  interval: number;
  /** ISO timestamp of the next due date. */
  dueAt: string;
  /** ISO timestamp of the last review, set after a grade. */
  lastReviewedAt?: string;
}

/**
 * Apply a grade to a card's SM-2 state and return the next state. Pure given
 * `now` (injected for deterministic tests).
 */
export function reviewCardState(
  state: Pick<CardState, 'repetitions' | 'easeFactor' | 'interval' | 'dueAt'>,
  grade: Grade,
  now: Date,
): CardState {
  const due = new Date(state.dueAt);
  const card = new Card(0, state.repetitions, state.easeFactor, state.interval, due);
  // The library throws if a card is reviewed before its due date. The review
  // flow only serves due cards, but clamp defensively so an early review is
  // treated as on-time rather than crashing.
  const reviewAt = now.getTime() >= due.getTime() ? now : due;
  const { card: next } = Scheduler.reviewCard(card, gradeToRating(grade), reviewAt);
  return {
    repetitions: next.n,
    easeFactor: next.EF,
    interval: next.I,
    dueAt: next.due.toISOString(),
    lastReviewedAt: now.toISOString(),
  };
}
