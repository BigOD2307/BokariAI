import { describe, it, expect } from 'vitest';
import {
  gradeToRating,
  reviewCardState,
  type CardState,
} from '@/lib/agents/learn/scheduler';

const NOW = new Date('2026-06-05T10:00:00.000Z');
const fresh: Pick<CardState, 'repetitions' | 'easeFactor' | 'interval' | 'dueAt'> = {
  repetitions: 0,
  easeFactor: 2.5,
  interval: 0,
  dueAt: NOW.toISOString(),
};

describe('learn/scheduler — grade mapping', () => {
  it('maps the four buttons to SM-2 ratings (pass boundary 3)', () => {
    expect(gradeToRating('again')).toBe(2);
    expect(gradeToRating('hard')).toBe(3);
    expect(gradeToRating('good')).toBe(4);
    expect(gradeToRating('easy')).toBe(5);
  });
});

describe('learn/scheduler — SM-2 review', () => {
  it('advances a good grade: repetitions up, due in the future', () => {
    const next = reviewCardState(fresh, 'good', NOW);
    expect(next.repetitions).toBe(1);
    expect(next.interval).toBeGreaterThanOrEqual(1);
    expect(new Date(next.dueAt).getTime()).toBeGreaterThan(NOW.getTime());
    expect(next.lastReviewedAt).toBe(NOW.toISOString());
  });

  it('resets repetitions on "again" (fail)', () => {
    const learned = reviewCardState(
      reviewCardState(fresh, 'good', NOW),
      'good',
      NOW,
    );
    expect(learned.repetitions).toBe(2);
    const lapsed = reviewCardState(learned, 'again', NOW);
    expect(lapsed.repetitions).toBe(0);
  });

  it('grows the interval fastest for "easy" vs "hard"', () => {
    const easy = reviewCardState(
      reviewCardState(fresh, 'easy', NOW),
      'easy',
      NOW,
    );
    const hard = reviewCardState(
      reviewCardState(fresh, 'hard', NOW),
      'hard',
      NOW,
    );
    expect(easy.interval).toBeGreaterThanOrEqual(hard.interval);
    expect(easy.easeFactor).toBeGreaterThanOrEqual(hard.easeFactor);
  });
});
