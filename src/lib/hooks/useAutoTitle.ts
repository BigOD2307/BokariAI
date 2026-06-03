'use client';

import { useEffect, useRef } from 'react';

interface UseAutoTitleOptions {
  chatId: string | null;
  firstMessage: string | null;
  enabled?: boolean;
}

export const useAutoTitle = ({
  chatId,
  firstMessage,
  enabled = true,
}: UseAutoTitleOptions): void => {
  const fired = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    if (!chatId || !firstMessage) return;
    if (firstMessage.length < 6) return;
    if (fired.current) return;
    fired.current = true;

    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/chats/${chatId}/auto-title`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstMessage }),
        signal: controller.signal,
      }).catch(() => {
        fired.current = false;
      });
    }, 1500);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [chatId, firstMessage, enabled]);
};
