import type { ActionOutput } from '../types';

const MAX_ITEMS = 12;
const SNIPPET_CHARS = 150;

/**
 * What the researcher LLM sees of a tool result.
 *
 * The previous code fed back `JSON.stringify(action)` — the full result set,
 * including whatever a page-read had produced — on every iteration. Quality
 * mode then grew the prompt quadratically and hit a token-limit rejection by
 * iteration six (BUG-07). The researcher plans; it does not write. It needs
 * to know WHAT was found, not what it says — the full content is not lost,
 * it stays in `ResearcherOutput.searchFindings` and is what evidence
 * selection (src/lib/retrieval/select.ts) later works from.
 */
export function summariseActionOutput(output: ActionOutput): string {
  if (output.type !== 'search_results') {
    return JSON.stringify(output);
  }
  const lines = output.results.slice(0, MAX_ITEMS).map((chunk, i) => {
    const title = chunk.metadata?.title ?? '(sans titre)';
    const url = chunk.metadata?.url ?? '';
    const publishedAt = chunk.metadata?.publishedAt;
    const date = publishedAt ? ` [${String(publishedAt).slice(0, 10)}]` : '';
    return `${i + 1}. ${title}${date} — ${url}\n   ${(chunk.content ?? '').slice(0, SNIPPET_CHARS)}`;
  });
  const omitted = Math.max(0, output.results.length - MAX_ITEMS);
  return [
    `${output.results.length} résultat(s).`,
    ...lines,
    omitted > 0 ? `(+${omitted} autres, disponibles pour la rédaction)` : '',
  ]
    .filter(Boolean)
    .join('\n');
}
