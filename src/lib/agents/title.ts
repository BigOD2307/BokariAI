import { resolveModels } from '@/lib/ai/resolve';
import { ROLE_OPTIONS } from '@/lib/ai/roles';

const SYSTEM_PROMPT = `Tu génères un titre court (3-7 mots) en français ou anglais pour une conversation de recherche.
Réponds UNIQUEMENT avec le titre, sans guillemets, sans point final, sans préfixe.`;

export interface GeneratedTitle {
  title: string;
  /** Which tier actually answered — the configured chat model, or the local
   *  truncation fallback when the LLM call itself failed. */
  model: string | 'fallback';
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

/**
 * Generate a short conversation title from the first message.
 *
 * Used to route through a direct `fetch` to OpenAI with `gpt-4o-mini`
 * hardcoded and its own `OPENAI_API_KEY` read — bypassing the gateway
 * entirely, so an OpenAI-less deployment silently never got titles. Now goes
 * through the same server-decided model + fallback as the rest of the chat
 * (src/lib/ai/resolve.ts, src/lib/ai/gateway.ts).
 */
export const generateTitle = async (
  firstMessage: string,
): Promise<GeneratedTitle> => {
  const start = Date.now();
  const trimmed = firstMessage.trim().slice(0, 500);

  try {
    const { llm, fastLlm } = await resolveModels();
    const model = fastLlm ?? llm;
    const { content } = await model.call(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: trimmed },
      ],
      ROLE_OPTIONS.title,
    );
    const cleaned = content.trim().replace(/^["']|["']$/g, '').slice(0, 80);
    if (!cleaned) {
      return {
        title: fallbackTitle(trimmed),
        model: 'fallback',
        latencyMs: Date.now() - start,
      };
    }
    return { title: cleaned, model: fastLlm ? 'fast-tier' : 'configured', latencyMs: Date.now() - start };
  } catch {
    return {
      title: fallbackTitle(trimmed),
      model: 'fallback',
      latencyMs: Date.now() - start,
    };
  }
};
