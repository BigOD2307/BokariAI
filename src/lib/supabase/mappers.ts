/**
 * Map Supabase snake_case DB rows to camelCase for frontend compatibility.
 * Tolerant of pre-Phase-0 SQLite-shaped rows.
 */
import type { Block } from '@/lib/types';

function safeArray<T>(text: string | null | undefined, fallback: T[] = []): T[] {
  if (!text) return fallback;
  if (Array.isArray(text)) return text as T[];
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function mapChat(row: any) {
  if (!row) return row;
  return {
    id: row.id,
    userId: row.user_id ?? row.userId ?? null,
    title: row.title,
    createdAt: row.created_at ?? row.createdAt,
    sources: safeArray<any>(row.sources, []),
    files: safeArray<any>(row.files, []),
  };
}

export function mapMessage(row: any) {
  if (!row) return row;
  return {
    id: row.id,
    messageId: row.message_id ?? row.messageId,
    chatId: row.chat_id ?? row.chatId,
    backendId: row.backend_id ?? row.backendId ?? '',
    query: row.query ?? '',
    createdAt: row.created_at ?? row.createdAt,
    responseBlocks: safeArray<Block>(row.response_blocks ?? row.responseBlocks, []),
    status: row.status,
  };
}

export function mapChats(rows: any[]) {
  return (rows || []).map(mapChat);
}

export function mapMessages(rows: any[]) {
  return (rows || []).map(mapMessage);
}
