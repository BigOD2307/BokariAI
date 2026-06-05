/**
 * @module agents/learn/runLearnBundle
 * @description Pure helper: given a query + the search-results context + an
 *   LLM, calls `learnBundlePrompt`, parses the JSON (tolerating markdown
 *   fences), and validates it against `learnBundleSchema`. Returns the bundle
 *   or null on any failure — the agent degrades to a plain Socratic reply.
 *
 *   No network of its own: the LLM is injected (the same LlmCallable shape used
 *   by the chart / rich-block extractors), so this is unit-testable.
 */
import { learnBundlePrompt } from './prompt';
import { learnBundleSchema, type LearnBundle } from './schema';
import type { LlmCallable } from '@/lib/agents/multimodal/charts';

/** Parse JSON, tolerating leading prose or ```json fences by slicing the
 *  outermost braces. Returns null on failure (never throws). */
export function parseJsonLoose(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    /* fall through to brace extraction */
  }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

export async function runLearnBundle(
  query: string,
  searchResultsText: string,
  llm: LlmCallable,
): Promise<LearnBundle | null> {
  const prompt = learnBundlePrompt(query, searchResultsText);
  let res: { content: string };
  try {
    res = await llm.call([{ role: 'user', content: prompt }]);
  } catch {
    return null;
  }
  const parsed = parseJsonLoose(res.content);
  if (parsed === null) return null;
  const result = learnBundleSchema.safeParse(parsed);
  return result.success ? result.data : null;
}
