'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useReducedMotion } from 'motion/react';
import { toast } from 'sonner';
import TextareaAutosize from 'react-textarea-autosize';
import {
  ArrowRight,
  Plus,
  Paperclip,
  Mic,
  Square,
  Zap,
  Gauge,
  Layers,
  Check,
  X,
  Image as ImageIcon,
  FileText,
  type LucideIcon,
} from 'lucide-react';
import { fileToAttachment, MultipartUploadError } from '@/lib/uploads/multimodal';
import {
  setPendingLandingAttachments,
  markFreshChat,
  setPendingLandingQuery,
} from '@/lib/uploads/landingHandoff';
import type { Attachment } from '@/lib/types/multimodal';

type SearchMode = 'rapide' | 'standard' | 'approfondi';

const MODES: { key: SearchMode; label: string; Icon: LucideIcon }[] = [
  { key: 'rapide', label: 'Rapide', Icon: Zap },
  { key: 'standard', label: 'Standard', Icon: Gauge },
  { key: 'approfondi', label: 'Approfondi', Icon: Layers },
];

const ACCEPTED = 'image/jpeg,image/png,image/webp,image/gif,application/pdf';
const MAX_FILES = 4;
const WAVE_BARS = 28;

const PROMPTS = [
  "Demande à Bokari l'actualité du jour…",
  'Le taux de change du CFA aujourd’hui ?',
  'Vérifie une info avant de la partager…',
  'Que se passe-t-il au Sahel cette semaine ?',
  'Explique-moi le mobile money en Afrique…',
];

function useTypewriter(phrases: string[], enabled: boolean): string {
  const reduce = useReducedMotion();
  const [text, setText] = useState(phrases[0]);
  useEffect(() => {
    if (!enabled || reduce) {
      setText(phrases[0]);
      return;
    }
    let phrase = 0;
    let ch = 0;
    let deleting = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const current = phrases[phrase];
      if (!deleting) {
        ch += 1;
        setText(current.slice(0, ch));
        if (ch >= current.length) {
          deleting = true;
          timer = setTimeout(tick, 1600);
          return;
        }
        timer = setTimeout(tick, 55);
      } else {
        ch -= 1;
        setText(current.slice(0, ch));
        if (ch <= 0) {
          deleting = false;
          phrase = (phrase + 1) % phrases.length;
          timer = setTimeout(tick, 320);
          return;
        }
        timer = setTimeout(tick, 26);
      }
    };
    timer = setTimeout(tick, 600);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, reduce]);
  return text;
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

type Props = {
  registerFocus?: (fn: () => void) => void;
};

/**
 * The landing search box — Bokari Canvas (light) skin.
 *  - Empty field → a MIC button; typing → the send (arrow) button.
 *  - Clicking the mic enters a recording state with a ChatGPT-style waveform
 *    that flows right → left, plus a timer, stop (✓) and cancel (✕).
 *  - A "+" menu holds the search mode + "Ajouter un fichier".
 *  - Empty state shows a Lovable-style typewriter placeholder.
 *
 * NOTE: real speech-to-text is wired LATER. `startRecording`/`stopRecording`
 * currently drive only the recording UI; swap their bodies for the
 * `useElevenLabsSTT` hook (start → record, stop → transcribe into `message`).
 */
const LandingComposer = ({ registerFocus }: Props) => {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<SearchMode>('standard');
  const [menuOpen, setMenuOpen] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const placeholder = useTypewriter(PROMPTS, message.length === 0 && !isFocused && !recording);

  useEffect(() => {
    setMounted(true);
    registerFocus?.(() => inputRef.current?.focus());
  }, [registerFocus]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  // Recording timer.
  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [recording]);

  const goToChat = (query: string) => {
    const q = query.trim();
    if (q.length === 0) return;
    if (attachments.length > 0) setPendingLandingAttachments(attachments);
    const arr = new Uint8Array(20);
    globalThis.crypto.getRandomValues(arr);
    const id = Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
    markFreshChat(id);
    setPendingLandingQuery(q);
    const modeParam = mode !== 'standard' ? `&mode=${mode}` : '';
    router.push(`/c/${id}?q=${encodeURIComponent(q)}${modeParam}`);
  };

  // Recording — UI only for now (real STT wired later via useElevenLabsSTT).
  const startRecording = () => {
    setSeconds(0);
    setRecording(true);
  };
  const stopRecording = () => {
    setRecording(false);
    // TODO(stt): const text = await stt.stopRecording(); if (text) setMessage((p) => (p ? `${p} ${text}` : text));
    inputRef.current?.focus();
  };
  const cancelRecording = () => setRecording(false);

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;
    setBusy(true);
    try {
      for (const file of files) {
        if (attachments.length >= MAX_FILES) {
          toast.error(`Maximum ${MAX_FILES} fichiers`);
          break;
        }
        const att = await fileToAttachment(file);
        setAttachments((prev) => (prev.length >= MAX_FILES ? prev : [...prev, att]));
      }
    } catch (err) {
      toast.error(err instanceof MultipartUploadError ? err.message : 'Erreur lors du téléversement');
    } finally {
      setBusy(false);
    }
  };

  const removeAttachment = (id: string) =>
    setAttachments((prev) => prev.filter((a) => a.id !== id));

  const hasText = message.trim().length > 0;

  return (
    <div className="relative z-10">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          goToChat(message);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && !recording) {
            e.preventDefault();
            goToChat(message);
          }
        }}
        className={mounted ? 'animate-slide-up' : 'opacity-0'}
      >
        <div
          className={`flex w-full flex-col rounded-2xl border-2 bg-white transition-all duration-200 ${
            isFocused && !recording
              ? 'border-[color:var(--bk-teal,#14b8a6)] shadow-[0_0_0_4px_rgba(20,184,166,0.14)]'
              : 'border-[color:var(--bk-ink,#0f172a)] shadow-[0_4px_0_rgba(15,23,42,0.07)]'
          }`}
        >
          {recording ? (
            /* ── Recording state — waveform flows right → left (ChatGPT-style) ── */
            <div className="flex items-center gap-3 px-3.5 py-[18px]">
              <button
                type="button"
                onClick={cancelRecording}
                aria-label="Annuler l'enregistrement"
                className="flex h-9 w-9 flex-none items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-black/[0.04] hover:text-[color:var(--bk-ink,#0f172a)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--bk-teal,#14b8a6)]"
              >
                <X size={18} strokeWidth={2.4} aria-hidden="true" />
              </button>

              <span className="flex flex-none items-center gap-2 font-hand text-[13px] tabular-nums text-[color:var(--bk-ink-soft,#334155)]">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500 motion-safe:animate-pulse" aria-hidden="true" />
                {mmss(seconds)}
              </span>

              <div className="bk-rec-fade relative h-7 flex-1 overflow-hidden" aria-hidden="true">
                <div className="bk-rec-track">
                  {Array.from({ length: WAVE_BARS * 2 }).map((_, i) => (
                    <span
                      key={i}
                      className="bk-rec-bar"
                      style={{
                        height: `${28 + ((i * 53) % 60)}%`,
                        animationDelay: `${(i % WAVE_BARS) * 0.06}s`,
                      }}
                    />
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={stopRecording}
                aria-label="Terminer l'enregistrement"
                className="flex h-9 w-9 flex-none items-center justify-center rounded-xl border-2 border-[color:var(--bk-teal-700,#0f766e)] bg-[color:var(--bk-teal,#14b8a6)] text-white shadow-[0_3px_0_var(--bk-teal-700,#0f766e)] transition-transform active:translate-y-[2px] active:shadow-[0_1px_0_var(--bk-teal-700,#0f766e)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--bk-teal,#14b8a6)] focus-visible:ring-offset-2"
              >
                <Square size={14} className="fill-current" strokeWidth={0} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <>
              <div className="px-5 pt-5 pb-3">
                <TextareaAutosize
                  ref={inputRef}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  minRows={1}
                  maxRows={8}
                  className="w-full resize-none bg-transparent text-[16px] leading-relaxed text-[color:var(--bk-ink,#0f172a)] outline-none placeholder:text-slate-400 md:text-[17px]"
                  placeholder={placeholder}
                />
              </div>

              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 px-5 pb-1">
                  {attachments.map((att) => (
                    <span
                      key={att.id}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--bk-ink,#0f172a)]/15 bg-white px-2 py-1 text-[12px] text-[color:var(--bk-ink,#0f172a)]"
                    >
                      {att.kind === 'image' ? (
                        <ImageIcon size={13} strokeWidth={2} className="text-[color:var(--bk-teal-600,#0d9488)]" aria-hidden="true" />
                      ) : (
                        <FileText size={13} strokeWidth={2} className="text-[color:var(--bk-teal-600,#0d9488)]" aria-hidden="true" />
                      )}
                      <span className="max-w-[140px] truncate">{att.filename}</span>
                      <button
                        type="button"
                        onClick={() => removeAttachment(att.id)}
                        aria-label={`Retirer ${att.filename}`}
                        className="text-slate-400 hover:text-[color:var(--bk-ink,#0f172a)]"
                      >
                        <X size={13} strokeWidth={2.4} aria-hidden="true" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Bottom toolbar — "+" menu (left) · mic / send (right) */}
              <div className="flex items-center justify-between gap-2 px-3 pb-3">
                <div ref={menuRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setMenuOpen((o) => !o)}
                    aria-haspopup="menu"
                    aria-expanded={menuOpen}
                    aria-label="Options : mode de recherche et fichiers"
                    className={`flex h-9 w-9 items-center justify-center rounded-xl border-2 border-[color:var(--bk-ink,#0f172a)]/12 text-[color:var(--bk-ink-soft,#334155)] transition-all hover:border-[color:var(--bk-ink,#0f172a)]/25 hover:text-[color:var(--bk-ink,#0f172a)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--bk-teal,#14b8a6)] ${
                      menuOpen ? 'bg-black/[0.03]' : ''
                    }`}
                  >
                    <Plus
                      size={18}
                      strokeWidth={2.4}
                      className={`transition-transform ${menuOpen ? 'rotate-45' : ''}`}
                      aria-hidden="true"
                    />
                  </button>

                  {menuOpen && (
                    <div
                      role="menu"
                      className="animate-fade-in absolute bottom-full left-0 z-30 mb-2 w-56 rounded-xl border-2 border-[color:var(--bk-ink,#0f172a)] bg-white p-1.5 shadow-[0_8px_0_rgba(15,23,42,0.06)]"
                    >
                      <p className="px-2 pb-1 pt-1 text-[11px] font-medium uppercase tracking-wider text-slate-400">
                        Mode de recherche
                      </p>
                      {MODES.map((m) => {
                        const active = m.key === mode;
                        return (
                          <button
                            key={m.key}
                            type="button"
                            role="menuitemradio"
                            aria-checked={active}
                            onClick={() => setMode(m.key)}
                            className={`font-hand flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[14px] transition-colors ${
                              active
                                ? 'bg-[color:var(--bk-teal,#14b8a6)]/10 text-[color:var(--bk-teal-700,#0f766e)]'
                                : 'text-[color:var(--bk-ink,#0f172a)] hover:bg-black/[0.04]'
                            }`}
                          >
                            <m.Icon size={15} strokeWidth={2.2} aria-hidden="true" />
                            <span className="flex-1">{m.label}</span>
                            {active && <Check size={15} strokeWidth={2.6} aria-hidden="true" />}
                          </button>
                        );
                      })}

                      <div className="my-1 h-px bg-[color:var(--bk-ink,#0f172a)]/10" aria-hidden="true" />

                      <button
                        type="button"
                        role="menuitem"
                        disabled={busy || attachments.length >= MAX_FILES}
                        onClick={() => {
                          setMenuOpen(false);
                          fileRef.current?.click();
                        }}
                        className="font-hand flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[14px] text-[color:var(--bk-ink,#0f172a)] transition-colors hover:bg-black/[0.04] disabled:cursor-not-allowed disabled:text-slate-300"
                      >
                        <Paperclip size={15} strokeWidth={2.2} aria-hidden="true" />
                        <span className="flex-1">Ajouter un fichier</span>
                      </button>
                    </div>
                  )}

                  <input
                    ref={fileRef}
                    type="file"
                    accept={ACCEPTED}
                    multiple
                    onChange={handleFiles}
                    className="hidden"
                  />
                </div>

                {hasText ? (
                  <button
                    type="submit"
                    aria-label="Rechercher"
                    className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-[color:var(--bk-teal-700,#0f766e)] bg-[color:var(--bk-teal,#14b8a6)] text-white shadow-[0_3px_0_var(--bk-teal-700,#0f766e)] transition-transform hover:-translate-y-px active:translate-y-[2px] active:shadow-[0_1px_0_var(--bk-teal-700,#0f766e)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--bk-teal,#14b8a6)] focus-visible:ring-offset-2"
                  >
                    <ArrowRight size={17} strokeWidth={2.5} aria-hidden="true" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={startRecording}
                    aria-label="Enregistrer un message vocal"
                    className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-[color:var(--bk-ink,#0f172a)]/12 text-[color:var(--bk-ink-soft,#334155)] transition-all hover:border-[color:var(--bk-teal,#14b8a6)]/40 hover:text-[color:var(--bk-teal-700,#0f766e)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--bk-teal,#14b8a6)]"
                  >
                    <Mic size={18} strokeWidth={2.2} aria-hidden="true" />
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </form>
    </div>
  );
};

export default LandingComposer;
