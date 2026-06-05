'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { freshChatId } from '@/lib/uploads/landingHandoff';

type ShortcutHandler = (event: KeyboardEvent) => void;

interface ShortcutMap {
  [key: string]: ShortcutHandler;
}

const isMac =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

const modKey = isMac ? 'meta' : 'ctrl';

const eventKey = (event: KeyboardEvent): string => {
  const parts: string[] = [];
  if (event.metaKey) parts.push('mod');
  if (event.ctrlKey) parts.push('mod');
  if (event.shiftKey) parts.push('shift');
  if (event.altKey) parts.push('alt');
  parts.push(event.key.toLowerCase());
  return parts.join('+');
};

export const useShortcuts = (shortcuts: ShortcutMap): void => {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      const isEditable =
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        target?.isContentEditable === true;
      const key = eventKey(event);
      if (key in shortcuts) {
        if (isEditable && !key.includes('mod')) return;
        event.preventDefault();
        shortcuts[key](event);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [shortcuts]);
};

export const useToggleSidebarShortcut = (toggle: () => void): void => {
  useShortcuts({ [`${modKey}+b`]: toggle });
};

export const useNewThreadShortcut = (): void => {
  const router = useRouter();
  useShortcuts({ [`${modKey}+k`]: () => router.push(`/c/${freshChatId()}`) });
};
