'use client';

import { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Check,
  Loader2,
  BookmarkPlus,
  PartyPopper,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/hooks/useAuth';
import { authFetch } from '@/lib/supabase/fetch';
import { cn } from '@/lib/utils';

type Card = { front: string; back: string };
export type Grade = 'again' | 'hard' | 'good' | 'easy';

const GRADE_BTNS: { grade: Grade; label: string; cls: string }[] = [
  { grade: 'again', label: 'Encore', cls: 'border-rose-300 text-rose-700 hover:bg-rose-50' },
  { grade: 'hard', label: 'Difficile', cls: 'border-amber-300 text-amber-700 hover:bg-amber-50' },
  { grade: 'good', label: 'Bien', cls: 'border-emerald-300 text-emerald-700 hover:bg-emerald-50' },
  { grade: 'easy', label: 'Facile', cls: 'border-[color:var(--bk-teal-400,#2dd4bf)] text-[color:var(--bk-teal-700,#0f766e)] hover:bg-[color:var(--bk-mint,#c8f4e0)]/40' },
];

interface Props {
  flashcards: Card[];
  deckId?: string;
  /** Chat preview: the originating question — enables the "Sauvegarder" CTA. */
  sourceQuery?: string;
  /** /learn: graded review (Encore / Difficile / Bien / Facile). */
  graded?: boolean;
  /** Graded callback: persist the grade for the card at `index`. */
  onGrade?: (index: number, grade: Grade) => Promise<void> | void;
}

/**
 * FlashcardDeck — flip cards in two modes:
 *  - preview (chat): flip + deck nav + a "Sauvegarder dans mes fiches" CTA that
 *    POSTs /api/decks (idempotent) so the deck lands in the /learn queue.
 *  - graded (/learn): flip to reveal, then grade Encore/Difficile/Bien/Facile
 *    (SM-2), advancing through the daily queue.
 */
const FlashcardDeck = ({
  flashcards,
  deckId,
  sourceQuery,
  graded,
  onGrade,
}: Props) => {
  const { user, setShowAuthModal } = useAuth();
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(!!deckId);
  const [grading, setGrading] = useState(false);

  if (!flashcards || flashcards.length === 0) return null;

  if (graded && index >= flashcards.length) {
    return (
      <div className="my-4 flex flex-col items-center gap-2 rounded-xl border-2 border-[color:var(--bk-ink,#0f172a)] bg-white p-8 text-center shadow-[0_3px_0_rgba(15,23,42,0.08)]">
        <PartyPopper size={28} className="text-[color:var(--bk-teal-600,#0d9488)]" />
        <p className="font-hand text-[16px] text-[color:var(--bk-ink,#0f172a)]">
          Révision terminée !
        </p>
        <p className="text-[13px] text-black/45">
          Tu as révisé {flashcards.length} fiche{flashcards.length > 1 ? 's' : ''}. Reviens demain.
        </p>
      </div>
    );
  }

  const card = flashcards[index]!;

  const nav = (delta: number) => {
    setFlipped(false);
    setIndex((p) => (p + delta + flashcards.length) % flashcards.length);
  };

  const grade = async (g: Grade) => {
    if (grading) return;
    setGrading(true);
    try {
      await onGrade?.(index, g);
    } catch {
      /* the page surfaces errors */
    } finally {
      setGrading(false);
      setFlipped(false);
      setIndex((p) => p + 1);
    }
  };

  const save = async () => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    if (!sourceQuery) return;
    setSaving(true);
    try {
      const res = await authFetch('/api/decks', {
        method: 'POST',
        body: JSON.stringify({
          sourceQuery,
          cards: flashcards.map((c) => ({ front: c.front, back: c.back })),
        }),
      });
      if (res.ok) {
        setSaved(true);
        toast.success('Fiches sauvegardées dans Apprendre');
      } else {
        toast.error('Sauvegarde échouée');
      }
    } catch {
      toast.error('Erreur réseau');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="my-4 rounded-xl border-2 border-[color:var(--bk-ink,#0f172a)] bg-white p-4 shadow-[0_3px_0_rgba(15,23,42,0.08)]">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="font-hand text-[14px] uppercase tracking-wide text-[color:var(--bk-teal-700,#0f766e)]">
          {graded ? 'Révision' : 'Fiches de révision'}
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

      {graded ? (
        <div className="mt-3 grid grid-cols-4 gap-1.5">
          {GRADE_BTNS.map((b) => (
            <button
              key={b.grade}
              type="button"
              disabled={!flipped || grading}
              onClick={() => grade(b.grade)}
              className={cn(
                'rounded-[10px] border-2 py-2 text-[12px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                b.cls,
              )}
            >
              {b.label}
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => nav(-1)}
              className="inline-flex items-center gap-1 rounded-[10px] px-2.5 py-1.5 text-[13px] text-[color:var(--bk-ink-soft,#334155)] transition-colors hover:bg-[color:var(--bk-mint,#c8f4e0)]/40"
            >
              <ChevronLeft size={15} /> Précédent
            </button>
            <button
              type="button"
              onClick={() => nav(1)}
              className="inline-flex items-center gap-1 rounded-[10px] px-2.5 py-1.5 text-[13px] text-[color:var(--bk-ink-soft,#334155)] transition-colors hover:bg-[color:var(--bk-mint,#c8f4e0)]/40"
            >
              Suivant <ChevronRight size={15} />
            </button>
          </div>
          {sourceQuery && (
            <button
              type="button"
              onClick={save}
              disabled={saving || saved}
              className={cn(
                'font-hand inline-flex items-center gap-1.5 rounded-[10px] border-2 px-3 py-1.5 text-[13px] uppercase tracking-wide transition-colors disabled:opacity-60',
                saved
                  ? 'border-emerald-300 text-emerald-700'
                  : 'border-[color:var(--bk-ink,#0f172a)] text-[color:var(--bk-ink,#0f172a)] hover:bg-[color:var(--bk-mint,#c8f4e0)]/40',
              )}
            >
              {saving ? (
                <Loader2 size={14} className="animate-spin" />
              ) : saved ? (
                <Check size={14} />
              ) : (
                <BookmarkPlus size={14} />
              )}
              {saved ? 'Sauvegardé' : 'Sauvegarder'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default FlashcardDeck;
