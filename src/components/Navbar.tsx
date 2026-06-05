import { Download, FileText, FileDown } from 'lucide-react';
import { useEffect, useState, Fragment } from 'react';
import DeleteChat from './DeleteChat';
import ShareButton from './MessageActions/ShareButton';
import {
  Popover,
  PopoverButton,
  PopoverPanel,
  Transition,
} from '@headlessui/react';
import { useChat } from '@/lib/hooks/useChat';
import { exportChatAsPDF, exportChatAsMarkdown } from '@/lib/export/chatExport';

/**
 * Navbar — the chat top bar (active conversations) on DESKTOP. Perplexity-style,
 * adapted to Bokari Canvas: the thread title on the left; on the right a
 * "Partager" button (public link), a "Télécharger" menu (PDF / Markdown), and
 * delete. On mobile these actions live in the mobile top-bar "+" menu
 * (Sidebar/MobileActionsMenu), so this bar is hidden below `lg`.
 */
const Navbar = () => {
  const [title, setTitle] = useState<string>('');
  const { sections, chatId } = useChat();

  useEffect(() => {
    if (sections.length > 0 && sections[0].message) {
      const q = sections[0].message.query;
      setTitle(
        q.length > 48
          ? `${q.substring(0, 48).trim()}…`
          : q || 'Nouvelle conversation',
      );
    }
  }, [sections]);

  const downloadBtn =
    'font-hand inline-flex items-center gap-1.5 rounded-[10px] border-2 border-[color:var(--bk-ink,#0f172a)]/15 px-3 py-1.5 text-[14px] uppercase tracking-wide text-[color:var(--bk-ink-soft,#334155)] transition-colors hover:border-[color:var(--bk-ink,#0f172a)] hover:text-[color:var(--bk-ink,#0f172a)] focus:outline-none';

  return (
    <div className="sticky -mx-4 top-0 z-40 hidden border-b-2 border-[color:var(--bk-ink,#0f172a)] bg-[color:var(--bk-paper,#ffffff)]/85 backdrop-blur-md lg:mx-0 lg:block">
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 lg:px-5">
        {/* Left — thread title */}
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="truncate text-[14px] font-medium text-[color:var(--bk-ink,#0f172a)]">
            {title || 'Nouvelle conversation'}
          </h1>
        </div>

        {/* Right — Partager · Télécharger · Supprimer */}
        <div className="flex flex-shrink-0 items-center gap-2">
          {chatId && <ShareButton chatId={chatId} variant="button" />}

          <Popover className="relative">
            <PopoverButton
              className={downloadBtn}
              aria-label="Télécharger la conversation"
            >
              <Download size={15} strokeWidth={2.2} />
              <span className="hidden sm:inline">PDF</span>
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
              <PopoverPanel className="absolute right-0 z-50 mt-2 w-52 origin-top-right overflow-hidden rounded-[12px] border-2 border-[color:var(--bk-ink,#0f172a)] bg-white shadow-[0_12px_28px_-12px_rgba(15,23,42,0.35)]">
                <div className="p-1.5">
                  <p className="font-hand px-2.5 py-1.5 text-[11px] uppercase tracking-wide text-[color:var(--bk-teal-700,#0f766e)]">
                    Télécharger
                  </p>
                  <button
                    className="font-hand flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[14px] text-[color:var(--bk-ink,#0f172a)] transition-colors hover:bg-[color:var(--bk-mint,#c8f4e0)]/40"
                    onClick={() => exportChatAsPDF(sections, title || '')}
                  >
                    <FileDown
                      size={15}
                      strokeWidth={2.2}
                      className="text-[color:var(--bk-teal-600,#0d9488)]"
                    />
                    En PDF
                  </button>
                  <button
                    className="font-hand flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[14px] text-[color:var(--bk-ink,#0f172a)] transition-colors hover:bg-[color:var(--bk-mint,#c8f4e0)]/40"
                    onClick={() => exportChatAsMarkdown(sections, title || '')}
                  >
                    <FileText
                      size={15}
                      strokeWidth={2.2}
                      className="text-[color:var(--bk-teal-600,#0d9488)]"
                    />
                    En Markdown
                  </button>
                </div>
              </PopoverPanel>
            </Transition>
          </Popover>

          <DeleteChat redirect chatId={chatId!} chats={[]} setChats={() => {}} />
        </div>
      </div>
    </div>
  );
};

export default Navbar;
