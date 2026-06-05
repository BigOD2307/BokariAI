'use client';

import Navbar from './Navbar';
import Chat from './Chat';
import EmptyChatMessageInput from './EmptyChatMessageInput';
import NextError from 'next/error';
import { useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useChat } from '@/lib/hooks/useChat';
import { useAuth } from '@/lib/hooks/useAuth';
import { authFetch } from '@/lib/supabase/fetch';
import SettingsButtonMobile from './Settings/SettingsButtonMobile';
import { Loader2 } from 'lucide-react';

export type { BaseMessage, Message, File, Widget } from '@/lib/types/window';

const ChatWindow = () => {
  const { hasError, notFound, messages, isReady, chatId } = useChat();
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

  if (hasError) {
    return (
      <div className="relative">
        <div className="absolute w-full flex flex-row items-center justify-end mr-5 mt-5">
          <SettingsButtonMobile />
        </div>
        <div className="flex flex-col items-center justify-center min-h-screen gap-3">
          <div className="w-12 h-12 rounded-2xl bg-red-500/[0.06] flex items-center justify-center">
            <span className="text-red-500 text-lg">!</span>
          </div>
          <p className="text-black/50 dark:text-white/40 text-sm text-center">
            Impossible de se connecter au serveur.
            <br />
            <span className="text-[13px] text-black/35 dark:text-white/25">Veuillez reessayer plus tard.</span>
          </p>
        </div>
      </div>
    );
  }

  if (!isReady) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen w-full gap-3">
        <Loader2 className="w-6 h-6 text-bokari-500 animate-spin" />
        <span className="text-[13px] text-black/25 dark:text-white/20">Chargement...</span>
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

  // Empty chat opened directly — let the user type.
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-2xl">
          <EmptyChatMessageInput />
        </div>
      </div>
    </div>
  );
};

export default ChatWindow;
