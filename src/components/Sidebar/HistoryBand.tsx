'use client';

import { useChatHistory, type ChatSummary } from '@/lib/hooks/useChatHistory';
import { useState, useMemo } from 'react';
import { Search, Loader2, MessageSquare, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
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
  const { chats, loading, error, hasMore, loadMore, refresh, search, query } =
    useChatHistory();
  const pathname = usePathname();
  const [searchInput, setSearchInput] = useState('');

  const groups = useMemo(() => groupChats(chats), [chats]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await fetch(`/api/chats/${id}`, { method: 'DELETE' });
      await refresh();
    } catch {
      // ignore
    }
  };

  return (
    <div className={cn('flex flex-col min-h-0', className)}>
      <div className="px-3 pb-2">
        <div className="relative">
          <Search
            size={12}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-black/30 dark:text-white/25"
          />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              search(e.target.value);
            }}
            placeholder="Rechercher dans l'historique"
            className="w-full pl-7 pr-3 py-1.5 bg-black/[0.03] dark:bg-white/[0.04] border border-transparent rounded-lg text-[12px] text-black/85 dark:text-white/85 placeholder:text-black/30 dark:placeholder:text-white/25 outline-none focus:border-bokari-500/30 focus:bg-black/[0.04] dark:focus:bg-white/[0.05] transition-colors"
            aria-label="Rechercher dans l'historique"
          />
        </div>
      </div>

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
              {query.trim().length >= 2
                ? 'Aucun résultat'
                : 'Aucune conversation pour le moment'}
            </p>
          </div>
        )}

        {ORDER.filter((k) => groups.has(k)).map((groupName) => (
          <div key={groupName} className="mb-3">
            <p className="px-2 pt-1 pb-1 text-[10px] font-medium uppercase tracking-wider text-black/30 dark:text-white/25">
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
                        'group flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors',
                        isActive
                          ? 'bg-bokari-500/10 text-bokari-600 dark:text-bokari-400'
                          : 'text-black/55 dark:text-white/45 hover:bg-black/[0.03] dark:hover:bg-white/[0.04] hover:text-black/85 dark:hover:text-white/75',
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
