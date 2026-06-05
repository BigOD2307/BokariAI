'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { GraduationCap, Loader2, Sparkles } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { authFetch } from '@/lib/supabase/fetch';
import FlashcardDeck, { type Grade } from '@/components/MessageRenderer/FlashcardDeck';

type DueCard = { id: string; front: string; back: string };

/**
 * /learn — "Révision du jour". Loads the cards due now and runs the SM-2 review
 * queue (FlashcardDeck graded mode). Each grade is persisted via the review
 * route, which reschedules the card. Renders inside the app shell (Sidebar).
 */
export default function LearnPage() {
  const { user, loading: authLoading, setShowAuthModal } = useAuth();
  const [cards, setCards] = useState<DueCard[] | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setCards([]);
      return;
    }
    let cancelled = false;
    authFetch('/api/flashcards/due')
      .then((r) => (r.ok ? r.json() : { cards: [] }))
      .then((d) => {
        if (!cancelled) setCards(d.cards ?? []);
      })
      .catch(() => {
        if (!cancelled) setCards([]);
      });
    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  const grade = async (index: number, g: Grade) => {
    const card = cards?.[index];
    if (!card) return;
    try {
      await authFetch(`/api/flashcards/${card.id}/review`, {
        method: 'POST',
        body: JSON.stringify({ grade: g }),
      });
    } catch {
      /* best-effort: the next load reflects the true state */
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-1 py-8">
      <div className="mb-6 flex items-center gap-2.5">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] border-2 border-[color:var(--bk-ink,#0f172a)] bg-[color:var(--bk-mint,#c8f4e0)]/40">
          <GraduationCap size={18} className="text-[color:var(--bk-teal-700,#0f766e)]" />
        </span>
        <div>
          <h1 className="font-display text-[22px] leading-none text-[color:var(--bk-ink,#0f172a)]">
            Révision du jour
          </h1>
          {cards && cards.length > 0 && (
            <p className="font-hand text-[13px] text-[color:var(--bk-teal-700,#0f766e)]">
              {cards.length} fiche{cards.length > 1 ? 's' : ''} à réviser
            </p>
          )}
        </div>
      </div>

      {authLoading || cards === null ? (
        <div className="flex items-center justify-center py-16 text-[color:var(--bk-teal-600,#0d9488)]">
          <Loader2 size={22} className="animate-spin" />
        </div>
      ) : !user ? (
        <div className="rounded-xl border-2 border-dashed border-[color:var(--bk-ink,#0f172a)]/20 p-8 text-center">
          <p className="text-[14px] text-black/60">
            Connecte-toi pour réviser tes fiches.
          </p>
          <button
            type="button"
            onClick={() => setShowAuthModal(true)}
            className="font-hand mt-4 rounded-[10px] border-2 border-[color:var(--bk-teal-700,#0f766e)] bg-[color:var(--bk-teal,#14b8a6)] px-4 py-2 text-[14px] uppercase tracking-wide text-white shadow-[0_3px_0_var(--bk-teal-700,#0f766e)]"
          >
            Se connecter
          </button>
        </div>
      ) : cards.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-[color:var(--bk-ink,#0f172a)]/20 p-8 text-center">
          <Sparkles size={26} className="mx-auto text-[color:var(--bk-teal-600,#0d9488)]" />
          <p className="mt-2 text-[15px] font-medium text-[color:var(--bk-ink,#0f172a)]">
            Rien à réviser aujourd&apos;hui 🎉
          </p>
          <p className="mt-1 text-[13px] text-black/45">
            Passe une question en mode <strong>Apprendre</strong> puis « Sauvegarder » pour créer des fiches.
          </p>
          <Link
            href="/"
            className="font-hand mt-4 inline-block rounded-[10px] border-2 border-[color:var(--bk-ink,#0f172a)] bg-white px-4 py-2 text-[13px] uppercase tracking-wide text-[color:var(--bk-ink,#0f172a)] shadow-[0_2px_0_rgba(15,23,42,0.12)]"
          >
            Apprendre quelque chose
          </Link>
        </div>
      ) : (
        <FlashcardDeck flashcards={cards} graded onGrade={grade} />
      )}
    </div>
  );
}
