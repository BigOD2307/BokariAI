'use client';

import { useEffect, useState, useCallback } from 'react';

export interface ChatSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

interface UseChatHistoryResult {
  chats: ChatSummary[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  search: (query: string) => void;
  query: string;
}

const PAGE_SIZE = 50;

export const useChatHistory = (): UseChatHistoryResult => {
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const fetchPage = useCallback(
    async (nextCursor: string | null, searchQuery: string) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set('limit', String(PAGE_SIZE));
        if (nextCursor) params.set('cursor', nextCursor);
        if (searchQuery.trim().length >= 2) params.set('q', searchQuery.trim());
        const response = await fetch(`/api/chats/cursor?${params.toString()}`);
        if (!response.ok) {
          setError('Impossible de charger l\'historique');
          return;
        }
        const data = (await response.json()) as {
          chats: ChatSummary[];
          hasMore: boolean;
          nextCursor: string | null;
        };
        setChats((prev) =>
          nextCursor ? [...prev, ...data.chats] : data.chats,
        );
        setHasMore(data.hasMore);
        setCursor(data.nextCursor);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur réseau');
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const refresh = useCallback(async () => {
    setChats([]);
    setCursor(null);
    setHasMore(false);
    await fetchPage(null, query);
  }, [fetchPage, query]);

  const loadMore = useCallback(async () => {
    if (!cursor || loading) return;
    await fetchPage(cursor, query);
  }, [cursor, loading, fetchPage, query]);

  const search = useCallback(
    (next: string) => {
      setQuery(next);
      setChats([]);
      setCursor(null);
      setHasMore(false);
      fetchPage(null, next);
    },
    [fetchPage],
  );

  useEffect(() => {
    fetchPage(null, '');
  }, [fetchPage]);

  return {
    chats,
    loading,
    error,
    hasMore,
    loadMore,
    refresh,
    search,
    query,
  };
};
