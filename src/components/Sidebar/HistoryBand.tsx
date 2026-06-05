'use client';

import { useChatHistory, type ChatSummary } from '@/lib/hooks/useChatHistory';
import { useMemo } from 'react';
import { Loader2, MessageSquare, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { authFetch } from '@/lib/supabase/fetch';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'motion/react';

const formatRelative = (iso: string): string => {
  const date = new Date(iso);
  const now = Date.now();
  const diff = (now - date.getTime()) / 1000;
  if (diff < 60) return "À l'instant";
  if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)} h`;
  if (diff < 7 * 86400) return `Il y a ${Math.floor(diff / 86400)} j`;
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
};

const groupChats = (chats: ChatSummary[]): Map<string, ChatSummary[]> => {
  const groups = new Map<string, ChatSummary[]>();
  const now = Date.now();
  for (const chat of chats) {
    const t = new Date(chat.updatedAt).getTime();
    const diff = now - t;
    let key: string;
    if (diff < 86400) key = "Aujourd'hui";
    else if (diff < 2 * 86400) key = 'Hier';
    else if (diff < 7 * 86400) key = '7 derniers jours';
    else if (diff < 30 * 86400) key = 'Ce mois-ci';
    else key = 'Plus ancien';
    const list = groups.get(key) ?? [];
    list.push(chat);
    groups.set(key, list);
  }
  return groups;
};

const ORDER = ["Aujourd'hui", 'Hier', '7 derniers jours', 'Ce mois-ci', 'Plus ancien'];

interface HistoryBandProps {
  className?: string;
  onItemClick?: () => void;
}

const HistoryBand = ({ className, onItemClick }: HistoryBandProps) => {
  const { chats, loading, error, hasMore, loadMore, refresh } = useChatHistory();
  const pathname = usePathname();

  const groups = useMemo(() => groupChats(chats), [chats]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await authFetch(`/api/chats/${id}`, { method: 'DELETE' });
      await refresh();
    } catch {
      // ignore
    }
  };

  return (
    <div className={cn('flex flex-col min-h-0', className)}>
      <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 px-2">
        {loading && chats.length === 0 && (
          <div className="flex items-center justify-center py-6 text-black/35 dark:text-white/30">
            <Loader2 size={14} className="animate-spin" />
          </div>
        )}

        {error && (
          <p className="text-[11px] text-red-500/80 px-2 py-2">{error}</p>
        )}

        {!loading && chats.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <MessageSquare
              size={20}
              className="text-black/15 dark:text-white/15 mb-1.5"
            />
            <p className="text-[11px] text-black/35 dark:text-white/30 px-3 leading-snug">
              Aucune conversation pour le moment
            </p>
          </div>
        )}

        {ORDER.filter((k) => groups.has(k)).map((groupName) => (
          <div key={groupName} className="mb-3">
            <p className="font-hand px-2 pb-1 pt-1 text-[11px] uppercase tracking-wide text-[color:var(--bk-teal-700,#0f766e)]">
              {groupName}
            </p>
            <ul className="space-y-0.5">
              {(groups.get(groupName) ?? []).map((chat) => {
                const isActive =
                  pathname === `/c/${chat.id}` ||
                  pathname === `/chat/${chat.id}`;
                return (
                  <motion.li
                    key={chat.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.15 }}
                  >
                    <Link
                      href={`/c/${chat.id}`}
                      onClick={onItemClick}
                      className={cn(
                        'group flex items-center gap-2 rounded-[8px] border-2 px-2 py-1.5 transition-colors',
                        isActive
                          ? 'border-[color:var(--bk-mint-edge,#93e6c4)] bg-[color:var(--bk-mint,#c8f4e0)]/60 text-[color:var(--bk-ink,#0f172a)]'
                          : 'border-transparent text-[color:var(--bk-ink-soft,#334155)] hover:bg-[color:var(--bk-mint,#c8f4e0)]/30 hover:text-[color:var(--bk-ink,#0f172a)]',
                      )}
                      title={chat.title}
                    >
                      <span className="flex-1 min-w-0 truncate text-[12px]">
                        {chat.title}
                      </span>
                      <span className="flex-shrink-0 text-[10px] text-black/30 dark:text-white/20">
                        {formatRelative(chat.updatedAt)}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => handleDelete(chat.id, e)}
                        className="flex-shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-500 transition-all"
                        title="Supprimer"
                        aria-label={`Supprimer ${chat.title}`}
                      >
                        <Trash2 size={11} />
                      </button>
                    </Link>
                  </motion.li>
                );
              })}
            </ul>
          </div>
        ))}

        {hasMore && (
          <button
            type="button"
            onClick={loadMore}
            disabled={loading}
            className="w-full py-1.5 text-[11px] text-black/40 dark:text-white/30 hover:text-bokari-500 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <Loader2 size={11} className="animate-spin inline" />
            ) : (
              'Charger plus'
            )}
          </button>
        )}
      </div>
    </div>
  );
};

export default HistoryBand;
