'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  MessageCircle,
  Lock,
  Eye,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useGuestSession } from '@/lib/hooks/useAuth';
import { toast } from 'sonner';
import type { PublicChatView as PublicChatViewData } from '@/lib/types/shares';

interface PublicChatViewProps {
  data: PublicChatViewData;
}

const formatDate = (iso: string): string => {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
};

const PublicChatView = ({ data }: PublicChatViewProps) => {
  const { user, setShowAuthModal } = useAuth();
  const guest = useGuestSession();
  const [views, setViews] = useState(data.share.viewCount);
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    if (data.share.id) {
      fetch(`/api/shares/${data.share.id}/view`, { method: 'POST' }).catch(() => undefined);
    }
  }, [data.share.id]);

  useEffect(() => {
    if (user) setUnlocked(true);
  }, [user]);

  const showBlur = !unlocked;

  const handleUnlock = () => {
    if (user) {
      setUnlocked(true);
      return;
    }
    setShowAuthModal(true);
  };

  const question = data.firstUserMessage?.content ?? data.chat.title;
  const author = data.author.isAnonymous ? 'Utilisateur Bokari' : data.author.name;

  return (
    <main className="min-h-screen bg-light-primary dark:bg-dark-primary">
      <header className="sticky top-0 z-30 bg-light-primary/85 dark:bg-dark-primary/85 backdrop-blur-xl border-b border-black/[0.06] dark:border-white/[0.06]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <a
            href="/"
            className="flex items-center gap-2 text-[15px] text-black/80 dark:text-white/80"
            style={{ fontFamily: 'Instrument Serif, serif', fontStyle: 'italic' }}
          >
            <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-bokari-400 to-bokari-600 flex items-center justify-center">
              <span className="text-white text-xs font-bold" style={{ fontFamily: 'Instrument Serif, serif' }}>B</span>
            </div>
            Bokari
          </a>
          <div className="flex items-center gap-3 text-[12px] text-black/40 dark:text-white/35">
            <span className="inline-flex items-center gap-1.5">
              <Eye size={12} /> {views.toLocaleString('fr-FR')} vue{views !== 1 ? 's' : ''}
            </span>
            {!user && (
              <button
                onClick={() => setShowAuthModal(true)}
                className="text-bokari-600 dark:text-bokari-400 font-medium hover:underline"
              >
                Se connecter
              </button>
            )}
          </div>
        </div>
      </header>

      <article className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <div className="mb-6 text-[12px] text-black/40 dark:text-white/30 flex items-center gap-2">
          <span>Partage par {author}</span>
          <span>·</span>
          <span>{formatDate(data.share.createdAt)}</span>
          {data.share.isIndexed ? null : (
            <>
              <span>·</span>
              <span className="px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] uppercase tracking-wider">
                Noindex
              </span>
            </>
          )}
        </div>

        <h1
          className="text-2xl sm:text-3xl text-black/90 dark:text-white/90 tracking-tight leading-snug mb-8"
          style={{ fontFamily: 'Instrument Serif, Georgia, serif' }}
        >
          {question}
        </h1>

        {data.sources.length > 0 && (
          <section className="mb-8">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-black/40 dark:text-white/35 mb-3">
              Sources ({data.sources.length})
            </h2>
            <ul className="space-y-2">
              {data.sources.map((source, i) => (
                <li key={source.url} className="flex items-start gap-2.5">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-bokari-500/10 text-bokari-600 dark:text-bokari-400 text-[10px] font-medium flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-[13px] text-black/70 dark:text-white/65 hover:text-bokari-600 dark:hover:text-bokari-400 transition-colors"
                  >
                    {source.title}
                    <ExternalLink size={10} className="inline ml-1 opacity-50" />
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="relative">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-black/40 dark:text-white/35 mb-3">
            Reponse Bokari
          </h2>
          <div
            className="prose prose-sm dark:prose-invert max-w-none text-[15px] leading-relaxed text-black/85 dark:text-white/85"
            style={showBlur ? { filter: 'blur(7px)', userSelect: 'none' } : undefined}
            aria-hidden={showBlur}
          >
            {data.answer.split(/\n\n+/).map((paragraph, i) => (
              <p key={i} className="mb-3 last:mb-0">
                {paragraph}
              </p>
            ))}
          </div>

          {showBlur && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
            >
              <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-bokari-500/20 bg-white/95 dark:bg-dark-100/95 backdrop-blur-md shadow-elevated p-6 text-center">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-br from-bokari-400 to-bokari-600 flex items-center justify-center mb-4 shadow-lg shadow-bokari-500/20">
                  <Lock size={20} className="text-white" />
                </div>
                <h3 className="text-[16px] font-medium text-black/90 dark:text-white/90 mb-1.5">
                  {guest.queriesRemaining > 0
                    ? `Il te reste ${guest.queriesRemaining} question${guest.queriesRemaining > 1 ? 's' : ''} gratuite${guest.queriesRemaining > 1 ? 's' : ''}`
                    : 'Cree ton compte pour voir la reponse'}
                </h3>
                <p className="text-[13px] text-black/45 dark:text-white/40 mb-5">
                  {guest.queriesRemaining > 0
                    ? 'Inscris-toi pour debloquer les reponses illimitees et le mode Learn.'
                    : 'Quelques secondes suffisent — WhatsApp ou email.'}
                </p>
                <button
                  onClick={handleUnlock}
                  className="w-full py-3 rounded-xl text-[14px] font-medium bg-bokari-500 text-white hover:bg-bokari-600 active:scale-[0.99] transition-all duration-200 inline-flex items-center justify-center gap-2 shadow-sm shadow-bokari-500/15"
                >
                  <MessageCircle size={16} />
                  Continuer avec WhatsApp
                  <ArrowRight size={14} />
                </button>
                <p className="text-[11px] text-black/30 dark:text-white/25 mt-3">
                  C&apos;est gratuit, sans carte bancaire.
                </p>
              </div>
            </motion.div>
          )}
        </section>

        <section className="mt-12 pt-8 border-t border-black/[0.06] dark:border-white/[0.06]">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-black/40 dark:text-white/35 mb-3">
            La recherche qui a produit cette reponse
          </h2>
          <div className="flex flex-wrap gap-2">
            <span className="px-2.5 py-1 rounded-full bg-black/[0.04] dark:bg-white/[0.05] text-[11px] text-black/60 dark:text-white/60">
              Classification de la question
            </span>
            <span className="px-2.5 py-1 rounded-full bg-black/[0.04] dark:bg-white/[0.05] text-[11px] text-black/60 dark:text-white/60">
              Recherche web
            </span>
            <span className="px-2.5 py-1 rounded-full bg-black/[0.04] dark:bg-white/[0.05] text-[11px] text-black/60 dark:text-white/60">
              Lecture des sources
            </span>
            <span className="px-2.5 py-1 rounded-full bg-black/[0.04] dark:bg-white/[0.05] text-[11px] text-black/60 dark:text-white/60">
              Validation NLI
            </span>
            <span className="px-2.5 py-1 rounded-full bg-black/[0.04] dark:bg-white/[0.05] text-[11px] text-black/60 dark:text-white/60">
              Redaction
            </span>
          </div>
        </section>

        <section className="mt-12">
          <div className="rounded-2xl border border-bokari-500/15 bg-bokari-500/[0.03] p-6 sm:p-8 text-center">
            <h3
              className="text-[20px] sm:text-[22px] text-black/90 dark:text-white/90 mb-2 tracking-tight"
              style={{ fontFamily: 'Instrument Serif, Georgia, serif' }}
            >
              Ta propre reponse en 10 secondes
            </h3>
            <p className="text-[13px] text-black/50 dark:text-white/45 mb-5 max-w-md mx-auto">
              Pose ta question. Bokari cherche, valide chaque source par NLI,
              et te donne une reponse avec des sources numerotees.
            </p>
            <a
              href="/"
              className="inline-flex items-center gap-2 py-3 px-6 rounded-xl text-[14px] font-medium bg-bokari-500 text-white hover:bg-bokari-600 active:scale-[0.99] transition-all duration-200 shadow-sm shadow-bokari-500/15"
            >
              Essayer Bokari
              <ArrowRight size={14} />
            </a>
            <p className="text-[11px] text-black/30 dark:text-white/25 mt-3">
              Pas de carte bancaire. Pas de spam.
            </p>
          </div>
        </section>
      </article>

      <footer className="border-t border-black/[0.06] dark:border-white/[0.06] mt-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 flex items-center justify-between text-[12px] text-black/40 dark:text-white/35">
          <span>Made with Bokari</span>
          <div className="flex items-center gap-4">
            <a href="/" className="hover:text-bokari-500 transition-colors">
              Bokari.ai
            </a>
            <span>·</span>
            <a
              href="/p/about"
              className="hover:text-bokari-500 transition-colors"
            >
              A propos
            </a>
            <span>·</span>
            <a
              href="/p/privacy"
              className="hover:text-bokari-500 transition-colors"
            >
              Confidentialite
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
};

export default PublicChatView;
