/**
 * @module types/section
 * @description The `Section` type, extracted from `lib/hooks/useChat`
 * so that pure modules (e.g. Phase 8 feedback) can import it without
 * pulling in the chat hook and the Supabase client.
 *
 * @author Amadou — Dicken AI
 * @version 1.0.0
 */
import type { Message, Widget } from './types/window';

export type Section = {
  message: Message;
  widgets: Widget[];
  parsedTextBlocks: string[];
  speechMessage: string;
  thinkingEnded: boolean;
  suggestions?: string[];
};
