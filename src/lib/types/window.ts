/**
 * @module types/window
 * @description Type definitions for chat windows and the messages they hold.
 * Split out from `components/ChatWindow.tsx` so that pure modules
 * (like the Phase 8 `buildCapturedContext`) can import them without
 * transitively pulling in the chat hook and the Supabase client.
 *
 * @author Amadou — Dicken AI
 * @version 1.0.0
 */
import { Block } from './types';

export interface BaseMessage {
  chatId: string;
  messageId: string;
  createdAt: Date;
}

export interface Message extends BaseMessage {
  backendId: string;
  query: string;
  responseBlocks: Block[];
  status: 'answering' | 'completed' | 'error';
}

export interface File {
  fileName: string;
  fileExtension: string;
  fileId: string;
}

export interface Widget {
  widgetType: string;
  params: Record<string, any>;
}
