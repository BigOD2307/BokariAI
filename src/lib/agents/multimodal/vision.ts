/**
 * @module agents/multimodal/vision
 * @description OpenRouter vision call wrapper.  Sends an image
 *   (data URL) + text prompt to a chat-completions endpoint and
 *   returns the text + reported cost.  No streaming — vision
 *   responses are short, single-shot.
 *
 * @author Amadou — Dicken AI
 * @version 1.0.0
 */

import type { Attachment, VisionResult } from '@/lib/types/multimodal';

export interface OpenRouterVisionOptions {
  model: string;
  prompt: string;
  imageDataUrl: string;
  apiKey: string;
  maxTokens?: number;
}

export interface OpenRouterVisionResponse {
  text: string;
  costUsd: number;
  raw: unknown;
}

interface OpenRouterMessage {
  role: 'user';
  content: Array<
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string } }
  >;
}

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MAX_TOKENS = 1024;

export async function callOpenRouterVision(
  opts: OpenRouterVisionOptions,
): Promise<OpenRouterVisionResponse> {
  const messages: OpenRouterMessage[] = [
    {
      role: 'user',
      content: [
        { type: 'text', text: opts.prompt },
        { type: 'image_url', image_url: { url: opts.imageDataUrl } },
      ],
    },
  ];

  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: opts.model,
      messages,
      max_tokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
    }),
  });

  if (!res.ok) {
    const body = await safeReadText(res);
    throw new Error(`OpenRouter vision ${res.status}: ${body}`);
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { cost?: number };
  };

  const text = json.choices?.[0]?.message?.content ?? '';
  const costUsd = json.usage?.cost ?? 0;

  return { text, costUsd, raw: json };
}

async function safeReadText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 500);
  } catch {
    return '';
  }
}

export function visionResultFromText(
  attachment: Attachment,
  model: string,
  costUsd: number,
  start: number,
  text: string,
): VisionResult {
  return {
    attachmentId: attachment.id,
    description: text,
    model,
    costUsd,
    durationMs: Date.now() - start,
  };
}
