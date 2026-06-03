'use client';

import { useState, useEffect } from 'react';
import { Share2, Check, Copy, X, Link as LinkIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/hooks/useAuth';
import { cn } from '@/lib/utils';

interface ShareButtonProps {
  chatId: string;
  className?: string;
  size?: 'sm' | 'md';
}

const ShareButton = ({ chatId, className, size = 'md' }: ShareButtonProps) => {
  const { user, setShowAuthModal } = useAuth();
  const [open, setOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      const handle = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setOpen(false);
      };
      window.addEventListener('keydown', handle);
      return () => window.removeEventListener('keydown', handle);
    }
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
      if (data.alreadyShared) {
        toast.success('Lien recupere');
      } else {
        toast.success('Lien de partage cree');
      }
    } catch {
      toast.error('Erreur reseau');
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
      toast.success('Lien copie dans le presse-papiers');
    } catch {
      toast.error('Copie echouee');
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          'rounded-xl text-black/35 dark:text-white/30 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-all duration-200 hover:text-black/60 dark:hover:text-white/50',
          size === 'sm' ? 'p-1.5' : 'p-2',
          className,
        )}
        title="Partager cette conversation"
        aria-label="Partager cette conversation"
      >
        <Share2 size={size === 'sm' ? 14 : 16} />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-black/30 dark:bg-black/50 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[101] w-[min(420px,92vw)] bg-white dark:bg-dark-100 rounded-2xl border border-black/[0.08] dark:border-white/[0.08] shadow-elevated p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3
                    className="text-[18px] text-black/90 dark:text-white/90 tracking-tight"
                    style={{ fontFamily: 'Instrument Serif, Georgia, serif' }}
                  >
                    Partager cette conversation
                  </h3>
                  <p className="text-[12px] text-black/40 dark:text-white/35 mt-1">
                    Lien public, accessible a toute personne ayant l&apos;URL.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="p-1.5 rounded-lg text-black/30 dark:text-white/30 hover:bg-black/[0.04] dark:hover:bg-white/[0.04]"
                  aria-label="Fermer"
                >
                  <X size={16} />
                </button>
              </div>

              {loading && (
                <div className="flex items-center justify-center py-8 text-black/40 dark:text-white/35">
                  <div className="w-5 h-5 border-2 border-bokari-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}

              {!loading && shareUrl && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 p-2.5 bg-black/[0.03] dark:bg-white/[0.04] rounded-xl border border-black/[0.06] dark:border-white/[0.06]">
                    <LinkIcon size={14} className="text-black/40 dark:text-white/30 flex-shrink-0" />
                    <span className="flex-1 text-[12px] text-black/70 dark:text-white/70 truncate font-mono">
                      {shareUrl}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="p-1.5 rounded-lg text-black/50 dark:text-white/50 hover:bg-black/[0.06] dark:hover:bg-white/[0.06] hover:text-bokari-500 transition-colors"
                      title="Copier le lien"
                    >
                      {copied ? <Check size={14} className="text-bokari-500" /> : <Copy size={14} />}
                    </button>
                  </div>

                  <div className="rounded-xl bg-bokari-500/[0.04] border border-bokari-500/15 p-3">
                    <p className="text-[11px] text-black/60 dark:text-white/55 leading-relaxed">
                      <strong className="text-bokari-600 dark:text-bokari-400">Apercu partage :</strong> la
                      question et les sources sont visibles publiquement. La reponse est
                      floutee : le visiteur doit creer un compte pour la lire.
                      <br />
                      Indexee par Google par defaut. Tu peux desactiver dans{' '}
                      <span className="font-medium">Parametres &gt; Confidentialite</span>.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <a
                      href={shareUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="flex-1 py-2.5 text-center rounded-xl text-[13px] font-medium bg-bokari-500 text-white hover:bg-bokari-600 active:scale-[0.99] transition-all duration-200"
                    >
                      Ouvrir
                    </a>
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="px-4 py-2.5 rounded-xl text-[13px] font-medium border border-black/[0.08] dark:border-white/[0.08] text-black/70 dark:text-white/70 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors"
                    >
                      {copied ? 'Copie' : 'Copier le lien'}
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
