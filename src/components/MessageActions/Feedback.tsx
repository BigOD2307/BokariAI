'use client';

import { useState, useRef, useEffect } from 'react';
import { ThumbsUp, ThumbsDown, Loader2, Check, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChat } from '@/lib/hooks/useChat';
import type { Section } from '@/lib/types/section';
import { buildCapturedContext } from '@/lib/feedback/context';
import { FeedbackPayload, FeedbackRating } from '@/lib/types/feedback';

const COMMENT_MAX = 2000;

const submitFeedback = async (payload: FeedbackPayload): Promise<void> => {
  const res = await fetch('/api/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `Feedback save failed (${res.status}): ${text.slice(0, 200)}`,
    );
  }
};

const Feedback = ({ section }: { section: Section }) => {
  const {
    chatModelProvider,
    embeddingModelProvider,
    optimizationMode,
  } = useChat();

  const [rating, setRating] = useState<FeedbackRating>(0);
  const [pending, setPending] = useState<FeedbackRating>(0);
  const [showComment, setShowComment] = useState(false);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  // Close the popover on outside click.
  useEffect(() => {
    if (!showComment) return;
    const handler = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        setShowComment(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showComment]);

  const buildPayload = (
    next: FeedbackRating,
    commentText?: string | null,
  ): FeedbackPayload => {
    const latencyMs =
      section.message.status === 'completed' &&
      section.message.createdAt instanceof Date
        ? Date.now() - section.message.createdAt.getTime()
        : null;

    const captured = buildCapturedContext(section, {
      chatProvider: chatModelProvider.providerId || 'unknown',
      chatModel: chatModelProvider.key || 'unknown',
      embeddingProvider: embeddingModelProvider.providerId || 'unknown',
      embeddingModel: embeddingModelProvider.key || 'unknown',
      optimizationMode: optimizationMode || 'unknown',
      latencyMs,
    });

    return {
      messageId: section.message.messageId,
      chatId: section.message.chatId,
      rating: next,
      comment: commentText ?? null,
      captured,
    };
  };

  const send = async (
    next: FeedbackRating,
    commentText?: string | null,
  ) => {
    setPending(next);
    setError(null);
    try {
      await submitFeedback(buildPayload(next, commentText));
      setRating(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      setPending(0);
    }
  };

  const onThumb = (next: 1 | -1) => {
    // Toggle: if the user clicks the same thumb again, clear the rating.
    if (rating === next) {
      void send(0, null);
      return;
    }
    if (next === -1) {
      setShowComment(true);
      setComment('');
      return;
    }
    // 👍 : submit immediately, no comment prompt.
    void send(1, null);
  };

  const submitComment = () => {
    void send(-1, comment.trim() || null);
    setShowComment(false);
  };

  const isUp = rating === 1;
  const isDown = rating === -1;
  const upLoading = pending === 1;
  const downLoading = pending === -1;

  return (
    <div className="relative flex items-center gap-0.5">
      <button
        type="button"
        onClick={() => onThumb(1)}
        disabled={upLoading || downLoading}
        aria-label="Bonne reponse"
        title="Bonne reponse"
        className={`p-2 rounded-xl transition-all duration-200 ${
          isUp
            ? 'text-bokari-600 dark:text-bokari-400 bg-bokari-500/10'
            : 'text-black/35 dark:text-white/30 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] hover:text-black/60 dark:hover:text-white/50'
        }`}
      >
        {upLoading ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <ThumbsUp size={16} className={isUp ? 'fill-current' : ''} />
        )}
      </button>

      <button
        type="button"
        onClick={() => onThumb(-1)}
        disabled={upLoading || downLoading}
        aria-label="Mauvaise reponse"
        title="Mauvaise reponse"
        className={`p-2 rounded-xl transition-all duration-200 ${
          isDown
            ? 'text-red-500 bg-red-500/10'
            : 'text-black/35 dark:text-white/30 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] hover:text-black/60 dark:hover:text-white/50'
        }`}
      >
        {downLoading ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <ThumbsDown size={16} className={isDown ? 'fill-current' : ''} />
        )}
      </button>

      <AnimatePresence>
        {showComment && (
          <motion.div
            ref={popoverRef}
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.12 }}
            className="absolute right-0 top-full mt-2 z-50 w-72 rounded-2xl border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-[#1a1a1a] shadow-xl p-3"
          >
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[12px] font-medium text-black/70 dark:text-white/70">
                {"Qu'est-ce qui n'allait pas ?"}
              </p>
              <button
                type="button"
                onClick={() => setShowComment(false)}
                className="p-1 rounded-md text-black/30 dark:text-white/30 hover:bg-black/[0.04] dark:hover:bg-white/[0.04]"
                aria-label="Fermer"
              >
                <X size={12} />
              </button>
            </div>
            <textarea
              autoFocus
              value={comment}
              onChange={(e) => setComment(e.target.value.slice(0, COMMENT_MAX))}
              placeholder="Optionnel — vos retours entrainent Bokari."
              rows={3}
              className="w-full text-[12px] leading-relaxed resize-none rounded-lg border border-black/[0.08] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.02] px-2.5 py-2 text-black/80 dark:text-white/80 placeholder:text-black/30 dark:placeholder:text-white/25 focus:outline-none focus:border-bokari-500/40 focus:bg-bokari-500/[0.04]"
            />
            <div className="flex items-center justify-between mt-2">
              <span className="text-[10px] text-black/30 dark:text-white/25">
                {comment.length}/{COMMENT_MAX}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowComment(false)}
                  className="text-[11px] px-2.5 py-1 rounded-md text-black/50 dark:text-white/40 hover:bg-black/[0.04] dark:hover:bg-white/[0.04]"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={submitComment}
                  disabled={downLoading}
                  className="text-[11px] px-2.5 py-1 rounded-md bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 flex items-center gap-1"
                >
                  {downLoading ? (
                    <Loader2 size={11} className="animate-spin" />
                  ) : (
                    <Check size={11} />
                  )}
                  Envoyer
                </button>
              </div>
            </div>
            {error && (
              <p className="mt-1.5 text-[10px] text-red-500/90 break-words">
                {error}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {error && !showComment && (
        <p className="absolute right-0 top-full mt-1 text-[10px] text-red-500/90 max-w-[200px] text-right">
          {error}
        </p>
      )}
    </div>
  );
};

export default Feedback;
