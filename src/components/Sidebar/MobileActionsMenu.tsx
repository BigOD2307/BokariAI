'use client';

import { Fragment, useState } from 'react';
import {
  Plus,
  Share2,
  FileDown,
  FileText,
  MessageSquarePlus,
  Loader2,
} from 'lucide-react';
import {
  Popover,
  PopoverButton,
  PopoverPanel,
  Transition,
} from '@headlessui/react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useChat } from '@/lib/hooks/useChat';
import { useAuth } from '@/lib/hooks/useAuth';
import { exportChatAsPDF, exportChatAsMarkdown } from '@/lib/export/chatExport';
import { freshChatId } from '@/lib/uploads/landingHandoff';

/**
 * Mobile chat-actions menu — the "+" in the mobile top bar. Opens
 * { Nouveau chat · Partager · Télécharger (PDF / Markdown) }. Share + download
 * are fully wired (share POSTs /api/shares and copies the link). Chat-only
 * items are disabled when there is no active conversation (e.g. on /discover).
 */
const ITEM =
  'font-hand flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[14px] text-[color:var(--bk-ink,#0f172a)] transition-colors hover:bg-[color:var(--bk-mint,#c8f4e0)]/40 disabled:cursor-not-allowed disabled:opacity-35';

const MobileActionsMenu = () => {
  const router = useRouter();
  const { sections, chatId } = useChat();
  const { user, setShowAuthModal } = useAuth();
  const [sharing, setSharing] = useState(false);

  const hasChat = !!chatId && sections.length > 0;
  const title = sections[0]?.message?.query?.slice(0, 48) || 'chat';

  const share = async () => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    if (!chatId) return;
    setSharing(true);
    try {
      const res = await fetch('/api/shares', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message ?? 'Erreur lors du partage');
        return;
      }
      try {
        await navigator.clipboard.writeText(data.url);
        toast.success('Lien de partage copié');
      } catch {
        toast.success(`Lien : ${data.url}`);
      }
    } catch {
      toast.error('Erreur réseau');
    } finally {
      setSharing(false);
    }
  };

  return (
    <Popover className="relative">
      <PopoverButton
        className="rounded-[10px] p-2 text-[color:var(--bk-ink,#0f172a)]/55 transition-colors hover:bg-[color:var(--bk-mint,#c8f4e0)]/50 hover:text-[color:var(--bk-ink,#0f172a)] focus:outline-none"
        aria-label="Actions"
      >
        <Plus size={20} strokeWidth={2.25} />
      </PopoverButton>
      <Transition
        as={Fragment}
        enter="transition ease-out duration-150"
        enterFrom="opacity-0 translate-y-1"
        enterTo="opacity-100 translate-y-0"
        leave="transition ease-in duration-100"
        leaveFrom="opacity-100 translate-y-0"
        leaveTo="opacity-0 translate-y-1"
      >
        <PopoverPanel className="absolute right-0 z-50 mt-2 w-56 origin-top-right overflow-hidden rounded-[12px] border-2 border-[color:var(--bk-ink,#0f172a)] bg-white shadow-[0_12px_28px_-12px_rgba(15,23,42,0.35)]">
          {({ close }) => (
            <div className="p-1.5">
              <button
                className={ITEM}
                onClick={() => {
                  close();
                  router.push(`/c/${freshChatId()}`);
                }}
              >
                <MessageSquarePlus
                  size={15}
                  strokeWidth={2.2}
                  className="text-[color:var(--bk-teal-600,#0d9488)]"
                />
                Nouveau chat
              </button>
              <button
                className={ITEM}
                disabled={!hasChat || sharing}
                onClick={async () => {
                  await share();
                  close();
                }}
              >
                {sharing ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Share2
                    size={15}
                    strokeWidth={2.2}
                    className="text-[color:var(--bk-teal-600,#0d9488)]"
                  />
                )}
                Partager
              </button>
              <button
                className={ITEM}
                disabled={!hasChat}
                onClick={() => {
                  exportChatAsPDF(sections, title);
                  close();
                }}
              >
                <FileDown
                  size={15}
                  strokeWidth={2.2}
                  className="text-[color:var(--bk-teal-600,#0d9488)]"
                />
                Télécharger (PDF)
              </button>
              <button
                className={ITEM}
                disabled={!hasChat}
                onClick={() => {
                  exportChatAsMarkdown(sections, title);
                  close();
                }}
              >
                <FileText
                  size={15}
                  strokeWidth={2.2}
                  className="text-[color:var(--bk-teal-600,#0d9488)]"
                />
                Télécharger (Markdown)
              </button>
            </div>
          )}
        </PopoverPanel>
      </Transition>
    </Popover>
  );
};

export default MobileActionsMenu;
