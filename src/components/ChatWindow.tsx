'use client';

import Navbar from './Navbar';
import Chat from './Chat';
import EmptyChat from './EmptyChat';
import NextError from 'next/error';
import { useChat } from '@/lib/hooks/useChat';
import SettingsButtonMobile from './Settings/SettingsButtonMobile';
import { Loader2 } from 'lucide-react';

export type { BaseMessage, Message, File, Widget } from '@/lib/types/window';

const ChatWindow = () => {
  const { hasError, notFound, messages, isReady } = useChat();

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

  return isReady ? (
    notFound ? (
      <NextError statusCode={404} />
    ) : (
      <div className="min-h-screen flex flex-col">
        {messages.length > 0 ? (
          <>
            <Navbar />
            <Chat />
          </>
        ) : (
          <EmptyChat />
        )}
      </div>
    )
  ) : (
    <div className="flex flex-col items-center justify-center min-h-screen w-full gap-3">
      <Loader2 className="w-6 h-6 text-bokari-500 animate-spin" />
      <span className="text-[13px] text-black/25 dark:text-white/20">Chargement...</span>
    </div>
  );
};

export default ChatWindow;
