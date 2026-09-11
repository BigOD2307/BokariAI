import z from 'zod';
import { ClassifierInput, ClassifierOutput } from './types';
import { classifierPrompt } from '@/lib/prompts/search/classifier';
import formatChatHistoryAsString from '@/lib/utils/formatHistory';
import { ROLE_OPTIONS } from '@/lib/ai/roles';

// The social/youtube/academic/personal flags were removed from the prompt and
// schema: the client only ever sends sources=['web'] (there is no source
// picker in the UI), so those decisions were computed on every request and
// then gated off by `config.sources.includes(...)` — pure prompt cost. They
// come back with the source picker (B-36). Kept in the TYPE as always-false
// so the downstream code compiles unchanged.
const schema = z.object({
  classification: z.object({
    skipSearch: z
      .boolean()
      .describe('Indicates whether to skip the search step.'),
    newsSearch: z
      .boolean()
      .describe(
        'True when the query is about current events / recent news and needs a dated, fresh source rather than a timeless reference page.',
      ),
    showWeatherWidget: z
      .boolean()
      .describe('Indicates whether to show the weather widget.'),
    showStockWidget: z
      .boolean()
      .describe('Indicates whether to show the stock widget.'),
    showCalculationWidget: z
      .boolean()
      .describe('Indicates whether to show the calculation widget.'),
  }),
  standaloneFollowUp: z
    .string()
    .describe(
      "A self-contained, context-independent reformulation of the user's question.",
    ),
  complexity: z
    .enum(['simple', 'complex'])
    .describe(
      "Query reasoning depth: 'simple' for a straightforward factual/lookup/calculation query answerable from a single source; 'complex' for multi-step reasoning, source comparison, or synthesis.",
    ),
});

export const classify = async (input: ClassifierInput) => {
  const output = await input.llm.generateObject<typeof schema>({
    messages: [
      {
        role: 'system',
        content: classifierPrompt,
      },
      {
        role: 'user',
        content: `<conversation_history>\n${formatChatHistoryAsString(input.chatHistory)}\n</conversation_history>\n<user_query>\n${input.query}\n</user_query>`,
      },
    ],
    schema,
    options: ROLE_OPTIONS.classifier,
  });

  return output;
};

/**
 * Fallback used when the classifier call itself fails (rate limit, timeout,
 * malformed provider response). Defaults to "search the web, treat it as
 * complex" rather than killing the request — a wrong-but-safe plan beats no
 * plan at all.
 */
export const defaultClassification = (query: string): ClassifierOutput => ({
  classification: {
    skipSearch: false,
    newsSearch: false,
    showWeatherWidget: false,
    showStockWidget: false,
    showCalculationWidget: false,
  },
  standaloneFollowUp: query,
  complexity: 'complex',
});
