import { NextResponse } from 'next/server';

const MAX_TOKENS = 20;
const TEMPERATURE = 0.4;
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

const SYSTEM_PROMPT = `Tu génères un titre court (3-7 mots) en français ou anglais pour une conversation de recherche.
Reponds UNIQUEMENT avec le titre, sans guillemets, sans point final, sans prefixe.`;

export interface GeneratedTitle {
  title: string;
  model: 'gpt-4o-mini' | 'fallback';
  latencyMs: number;
}

const fallbackTitle = (firstMessage: string): string => {
  const cleaned = firstMessage
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return 'Nouvelle conversation';
  if (cleaned.length <= 40) return cleaned;
  const cut = cleaned.slice(0, 40);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 20 ? cut.slice(0, lastSpace) : cut) + '...';
};

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatChoice {
  message?: { content?: string };
}

interface ChatResponse {
  choices?: ChatChoice[];
}

const callOpenAI = async (
  apiKey: string,
  messages: ChatMessage[],
): Promise<string | null> => {
  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages,
      max_tokens: MAX_TOKENS,
      temperature: TEMPERATURE,
    }),
  });
  if (!response.ok) return null;
  const data = (await response.json()) as ChatResponse;
  return data.choices?.[0]?.message?.content ?? null;
};

export const generateTitle = async (
  firstMessage: string,
): Promise<GeneratedTitle> => {
  const start = Date.now();
  const trimmed = firstMessage.trim().slice(0, 500);
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      title: fallbackTitle(trimmed),
      model: 'fallback',
      latencyMs: Date.now() - start,
    };
  }
  try {
    const raw = await callOpenAI(apiKey, [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: trimmed },
    ]);
    const cleaned = raw?.trim().replace(/^["']|["']$/g, '').slice(0, 80) ?? '';
    if (!cleaned) {
      return {
        title: fallbackTitle(trimmed),
        model: 'fallback',
        latencyMs: Date.now() - start,
      };
    }
    return {
      title: cleaned,
      model: 'gpt-4o-mini',
      latencyMs: Date.now() - start,
    };
  } catch {
    return {
      title: fallbackTitle(trimmed),
      model: 'fallback',
      latencyMs: Date.now() - start,
    };
  }
};
