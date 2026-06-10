'use client';

import Navbar from './Navbar';
import Chat from './Chat';
import EmptyChatMessageInput from './EmptyChatMessageInput';
import NextError from 'next/error';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useChat } from '@/lib/hooks/useChat';
import { useAuth } from '@/lib/hooks/useAuth';
import { authFetch } from '@/lib/supabase/fetch';
import SettingsButtonMobile from './Settings/SettingsButtonMobile';
import { Loader2 } from 'lucide-react';

export type { BaseMessage, Message, File, Widget } from '@/lib/types/window';

const ChatWindow = () => {
  const {
    hasError,
    notFound,
    messages,
    isReady,
    chatId,
    isConfigReady,
    isMessagesLoaded,
    newChatCreated,
  } = useChat();
  const { user } = useAuth();
  const pendingQuery = useSearchParams().get('q');

  // When a guest signs in mid-conversation, re-own the chat so it lands in
  // their history. The blurred answer reveals on its own once `user` is set.
  const prevUserRef = useRef(user);
  const claimedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const justSignedIn = !prevUserRef.current && !!user;
    prevUserRef.current = user;
    if (
      justSignedIn &&
      chatId &&
      messages.length > 0 &&
      !claimedRef.current.has(chatId)
    ) {
      claimedRef.current.add(chatId);
      authFetch(`/api/chats/${chatId}/claim`, { method: 'POST' }).catch(() => {});
    }
  }, [user, chatId, messages.length]);

  // Watchdog: the app must NEVER spin on "Chargement…" forever, on any platform
  // or for any reason (slow network, a stalled API, a wedged auth call). If we
  // aren't ready within a sane window, fall through to an actionable retry
  // screen instead of an endless spinner.
  const [stalled, setStalled] = useState(false);
  useEffect(() => {
    if (isReady || hasError) {
      setStalled(false);
      return;
    }
    const t = setTimeout(() => setStalled(true), 12_000);
    return () => clearTimeout(t);
  }, [isReady, hasError]);

  // Client-only elapsed counter while we wait. Because this only advances after
  // hydration, its mere presence on screen proves the client JS ran — and the
  // per-flag breakdown tells us exactly what's stalling on a given device.
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (isReady) return;
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [isReady]);

  // TEMP beacon: if the app is still not ready after 8s/25s, ship the device's
  // state + on-device API self-tests to /api/diag so we can see (in server
  // logs) exactly what stalls on the devices we can't reproduce on.
  useEffect(() => {
    if (isReady) return;
    const probe = async (path: string) => {
      try {
        const t0 = Date.now();
        const r = await Promise.race([
          fetch(path),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
        ]);
        return r ? `${(r as Response).status} in ${Date.now() - t0}ms` : 'TIMEOUT>8s';
      } catch (e) {
        return 'ERR ' + ((e as Error)?.message || 'x');
      }
    };
    const send = async (tag: string) => {
      const [prov, chats] = await Promise.all([
        probe('/api/providers'),
        probe(`/api/chats/${chatId || 'none'}`),
      ]);
      try {
        await fetch('/api/diag', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tag,
            url: window.location.href,
            ua: navigator.userAgent,
            flags: { isConfigReady, isMessagesLoaded, newChatCreated, hasError, notFound },
            errors: (window as unknown as { __bkErrors?: string[] }).__bkErrors || [],
            prov,
            chats,
          }),
        });
      } catch {
        /* nothing else we can do */
      }
    };
    const t1 = setTimeout(() => void send('stall-8s'), 8_000);
    const t2 = setTimeout(() => void send('stall-25s'), 25_000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady]);

  const diag = (
    <span className="mt-1 text-[11px] text-black/30 dark:text-white/25 text-center font-mono">
      JS&nbsp;ok · config&nbsp;{isConfigReady ? '✓' : '…'} · chat&nbsp;
      {isMessagesLoaded ? '✓' : '…'} · new&nbsp;{newChatCreated ? '✓' : '…'} ·{' '}
      {elapsed}s
    </span>
  );

  if (hasError || stalled) {
    return (
      <div className="relative">
        <div className="absolute w-full flex flex-row items-center justify-end mr-5 mt-5">
          <SettingsButtonMobile />
        </div>
        <div className="flex flex-col items-center justify-center min-h-screen gap-4">
          <div className="w-12 h-12 rounded-2xl bg-red-500/[0.06] flex items-center justify-center">
            <span className="text-red-500 text-lg">!</span>
          </div>
          <p className="text-black/50 dark:text-white/40 text-sm text-center">
            Connexion un peu lente…
            <br />
            <span className="text-[13px] text-black/35 dark:text-white/25">Réessaie, ça repart.</span>
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-xl border-2 border-bokari-500/30 bg-bokari-500/[0.06] px-4 py-2 text-[13px] font-medium text-bokari-600 transition-colors hover:bg-bokari-500/10 dark:text-bokari-300"
          >
            Réessayer
          </button>
          {diag}
        </div>
      </div>
    );
  }

  if (!isReady) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen w-full gap-2">
        <Loader2 className="w-6 h-6 text-bokari-500 animate-spin" />
        <span className="text-[13px] text-black/25 dark:text-white/20">Chargement...</span>
        {elapsed >= 3 && diag}
      </div>
    );
  }

  // Active conversation — always wins (a sending/answering message must never
  // be hidden behind a 404).
  if (messages.length > 0) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <Chat />
      </div>
    );
  }

  // Arrived at a fresh chat with a pending `?q=` — the search is about to
  // auto-start; show a launch state (never a 404 while a query is in flight).
  if (pendingQuery) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen w-full gap-3">
        <Loader2 className="w-6 h-6 text-bokari-500 animate-spin" />
        <span className="text-[13px] text-black/40 dark:text-white/30">
          Lancement de la recherche…
        </span>
      </div>
    );
  }

  // Genuinely unknown chat (no messages, no pending query).
  if (notFound) {
    return <NextError statusCode={404} />;
  }

  // Empty chat / search page — just the chat box, no top bar.
  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-2xl">
          <EmptyChatMessageInput />
        </div>
      </div>
    </div>
  );
};

export default ChatWindow;
