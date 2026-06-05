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
import type {
  Attachment,
  ChartSpec,
  RichBlock,
  VisionResult,
} from './multimodal';
import type { FaithfulnessReport } from '@/lib/agents/search/faithfulness';

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
  attachments?: Attachment[];
  visionResults?: VisionResult[];
  charts?: ChartSpec[];
  /** Rich illustration blocks (comparison table / entity card / verdict). */
  richBlocks?: RichBlock[];
  /** Per-claim citation faithfulness verdict (NLI gate), when enabled. */
  faithfulness?: FaithfulnessReport;
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
