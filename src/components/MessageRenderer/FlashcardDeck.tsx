'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import type { Flashcard } from '@/lib/types';
import { cn } from '@/lib/utils';

/**
 * FlashcardDeck — review one flashcard at a time, tap/click to flip
 * (question ↔ answer), navigate the deck. v1 is preview-only (no SM-2 grading
 * yet — that lands with deck persistence + the /learn review page).
 */
const FlashcardDeck = ({ flashcards }: { flashcards: Flashcard[]; deckId?: string }) => {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  if (!flashcards || flashcards.length === 0) return null;
  const card = flashcards[index]!;
  const go = (delta: number) => {
    setFlipped(false);
    setIndex((p) => (p + delta + flashcards.length) % flashcards.length);
  };

  return (
    <div className="my-4 rounded-xl border-2 border-[color:var(--bk-ink,#0f172a)] bg-white p-4 shadow-[0_3px_0_rgba(15,23,42,0.08)]">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="font-hand text-[14px] uppercase tracking-wide text-[color:var(--bk-teal-700,#0f766e)]">
          Fiches de révision
        </h4>
        <span className="text-[12px] text-black/40">
          {index + 1} / {flashcards.length}
        </span>
      </div>

      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        className={cn(
          'flex min-h-[120px] w-full flex-col items-center justify-center gap-2 rounded-[12px] border-2 px-4 py-6 text-center transition-colors',
          flipped
            ? 'border-[color:var(--bk-teal-700,#0f766e)] bg-[color:var(--bk-mint,#c8f4e0)]/30'
            : 'border-[color:var(--bk-ink,#0f172a)]/15 bg-black/[0.02] hover:bg-black/[0.04]',
        )}
        aria-label="Retourner la fiche"
      >
        <p className="text-[15px] font-medium text-[color:var(--bk-ink,#0f172a)]">
          {flipped ? card.back : card.front}
        </p>
        <span className="font-hand inline-flex items-center gap-1 text-[11px] text-black/35">
          <RotateCcw size={11} />
          {flipped ? 'Réponse — clique pour la question' : 'Question — clique pour la réponse'}
        </span>
      </button>

      <div className="mt-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => go(-1)}
          className="inline-flex items-center gap-1 rounded-[10px] px-2.5 py-1.5 text-[13px] text-[color:var(--bk-ink-soft,#334155)] transition-colors hover:bg-[color:var(--bk-mint,#c8f4e0)]/40"
        >
          <ChevronLeft size={15} /> Précédent
        </button>
        <button
          type="button"
          onClick={() => go(1)}
          className="inline-flex items-center gap-1 rounded-[10px] px-2.5 py-1.5 text-[13px] text-[color:var(--bk-ink-soft,#334155)] transition-colors hover:bg-[color:var(--bk-mint,#c8f4e0)]/40"
        >
          Suivant <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
};

export default FlashcardDeck;
