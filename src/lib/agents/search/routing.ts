/**
 * Model-tier routing for the search agent — Perplexity's "smallest adequate
 * model" play. Simple / factual queries go to the FAST tier (e.g. Groq Llama
 * 3.1 8B) when one is configured; complex queries (multi-step reasoning,
 * synthesis) stay on the default 70B-class model. Always falls back safely to
 * the default when no fast tier is available or complexity is unknown.
 */
export function pickWriterLlm<T>(
  complexity: 'simple' | 'complex' | undefined,
  llm: T,
  fastLlm: T | undefined | null,
): T {
  return complexity === 'simple' && fastLlm ? fastLlm : llm;
}
