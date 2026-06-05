'use client';

import { useState, useEffect } from 'react';
import { Share2, Check, Copy, X, Link as LinkIcon, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/hooks/useAuth';
import { cn } from '@/lib/utils';

interface ShareButtonProps {
  chatId: string;
  className?: string;
  /** 'icon' = bare icon button · 'button' = labelled "Partager" button (top bar). */
  variant?: 'icon' | 'button';
}

/**
 * ShareButton — creates (or fetches) the public /p/[slug] share link for a chat
 * and shows it in a Canvas panel (link + copy + the "blurred answer" preview
 * note). Lives in the chat top bar.
 */
const ShareButton = ({ chatId, className, variant = 'icon' }: ShareButtonProps) => {
  const { user, setShowAuthModal } = useAuth();
  const [open, setOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [open]);

  const handleClick = async () => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    setOpen(true);
    if (shareUrl) return;
    setLoading(true);
    try {
      const response = await fetch('/api/shares', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId }),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.message ?? 'Erreur lors du partage');
        setOpen(false);
        return;
      }
      setShareUrl(data.url);
      toast.success(data.alreadyShared ? 'Lien récupéré' : 'Lien de partage créé');
    } catch {
      toast.error('Erreur réseau');
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      toast.success('Lien copié');
    } catch {
      toast.error('Copie échouée');
    }
  };

  return (
    <>
      {variant === 'button' ? (
        <button
          type="button"
          onClick={handleClick}
          className={cn(
            'font-hand inline-flex items-center gap-1.5 rounded-[10px] border-2 border-[color:var(--bk-ink,#0f172a)] bg-white px-3 py-1.5 text-[14px] uppercase tracking-wide text-[color:var(--bk-ink,#0f172a)] shadow-[0_2px_0_rgba(15,23,42,0.12)] transition-transform hover:-translate-y-px active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--bk-teal,#14b8a6)]',
            className,
          )}
          aria-label="Partager cette conversation"
        >
          <Share2 size={15} strokeWidth={2.2} className="text-[color:var(--bk-teal-600,#0d9488)]" />
          Partager
        </button>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          className={cn(
            'rounded-xl p-2 text-[color:var(--bk-ink,#0f172a)]/40 transition-colors hover:bg-[color:var(--bk-mint,#c8f4e0)]/50 hover:text-[color:var(--bk-ink,#0f172a)]',
            className,
          )}
          title="Partager cette conversation"
          aria-label="Partager cette conversation"
        >
          <Share2 size={16} />
        </button>
      )}

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-[color:var(--bk-ink,#0f172a)]/35 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
              className="fixed left-1/2 top-1/2 z-[101] w-[min(440px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-[20px] border-2 border-[color:var(--bk-ink,#0f172a)] bg-[color:var(--bk-paper,#ffffff)] p-6 shadow-[0_18px_44px_-14px_rgba(15,23,42,0.45)]"
            >
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <h3 className="font-display text-[22px] leading-none text-[color:var(--bk-ink,#0f172a)]">
                    Partager
                  </h3>
                  <p className="font-hand mt-1.5 text-[14px] text-[color:var(--bk-ink-soft,#334155)]">
                    Lien public, accessible à toute personne ayant l&apos;URL.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-[10px] text-[color:var(--bk-ink-soft,#334155)] transition-colors hover:bg-[color:var(--bk-mint,#c8f4e0)]/50 hover:text-[color:var(--bk-ink,#0f172a)]"
                  aria-label="Fermer"
                >
                  <X size={16} strokeWidth={2.25} />
                </button>
              </div>

              {loading && (
                <div className="flex items-center justify-center py-8 text-[color:var(--bk-teal-600,#0d9488)]">
                  <Loader2 size={22} className="animate-spin" />
                </div>
              )}

              {!loading && shareUrl && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 rounded-[10px] border-2 border-[color:var(--bk-ink,#0f172a)]/15 bg-white p-2.5">
                    <LinkIcon size={14} className="flex-shrink-0 text-[color:var(--bk-ink,#0f172a)]/40" />
                    <span className="flex-1 truncate font-mono text-[12px] text-[color:var(--bk-ink,#0f172a)]/75">
                      {shareUrl}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="rounded-lg p-1.5 text-[color:var(--bk-ink,#0f172a)]/50 transition-colors hover:bg-[color:var(--bk-mint,#c8f4e0)]/50 hover:text-[color:var(--bk-teal-700,#0f766e)]"
                      title="Copier le lien"
                    >
                      {copied ? <Check size={14} className="text-[color:var(--bk-teal-600,#0d9488)]" /> : <Copy size={14} />}
                    </button>
                  </div>

                  <div className="rounded-[12px] border-2 border-[color:var(--bk-mint-edge,#93e6c4)] bg-[color:var(--bk-mint,#c8f4e0)]/35 p-3">
                    <p className="text-[12px] leading-relaxed text-[color:var(--bk-ink-soft,#334155)]">
                      <strong className="text-[color:var(--bk-teal-700,#0f766e)]">Aperçu partagé :</strong> la
                      question et les sources sont visibles publiquement. La réponse est floutée — le
                      visiteur doit créer un compte pour la lire. Indexée par Google par défaut
                      (modifiable dans Paramètres ▸ Confidentialité).
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <a
                      href={shareUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="font-hand flex-1 rounded-[10px] border-2 border-[color:var(--bk-teal-700,#0f766e)] bg-[color:var(--bk-teal,#14b8a6)] py-2.5 text-center text-[14px] uppercase tracking-wide text-white shadow-[0_3px_0_var(--bk-teal-700,#0f766e)] transition-transform hover:-translate-y-px active:translate-y-px"
                    >
                      Ouvrir
                    </a>
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="font-hand rounded-[10px] border-2 border-[color:var(--bk-ink,#0f172a)] bg-white px-4 py-2.5 text-[14px] uppercase tracking-wide text-[color:var(--bk-ink,#0f172a)] shadow-[0_3px_0_rgba(15,23,42,0.10)] transition-transform active:translate-y-px"
                    >
                      {copied ? 'Copié' : 'Copier'}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default ShareButton;
