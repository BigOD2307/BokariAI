import { bm25Score, buildBM25Index, tokenize } from '@/lib/discover/bm25';
import type { ReadPage } from './read';

export type Passage = {
  url: string;
  /** 0-based index of the passage inside its page — lets the UI deep-link later. */
  index: number;
  text: string;
  score: number;
};

const TARGET_CHARS = 900;
const OVERLAP_CHARS = 150;

/**
 * Split on paragraph boundaries, packing paragraphs up to ~900 characters.
 *
 * Paragraph-aligned rather than fixed-width because a citation must be quotable:
 * cutting mid-sentence produces evidence that cannot be shown to a reader, which
 * defeats the point of a faithfulness check.
 */
export function splitIntoPassages(text: string): string[] {
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter((p) => p.length > 40);
  const passages: string[] = [];
  let current = '';

  for (const paragraph of paragraphs) {
    if (current && current.length + paragraph.length > TARGET_CHARS) {
      passages.push(current);
      current = current.slice(-OVERLAP_CHARS) + '\n\n' + paragraph;
    } else {
      current = current ? `${current}\n\n${paragraph}` : paragraph;
    }
  }
  if (current.trim()) passages.push(current.trim());

  return passages;
}

/**
 * Rank every passage of every page against the query, lexically.
 *
 * BM25 rather than embeddings at this stage, on purpose: it is free, it is
 * deterministic, and it runs over hundreds of passages in under a millisecond.
 * A cross-encoder rerank pass over the survivors is C6 territory.
 */
export function selectPassages(
  pages: ReadPage[],
  queries: string[],
  opts: { maxPerPage: number; maxTotal: number },
): Passage[] {
  const all: Array<{ url: string; index: number; text: string; tokens: string[] }> = [];

  for (const page of pages) {
    splitIntoPassages(page.text).forEach((text, index) => {
      all.push({ url: page.url, index, text, tokens: tokenize(text) });
    });
  }
  if (all.length === 0) return [];

  const { idf, avgdl } = buildBM25Index(all.map((p) => p.tokens));
  const queryVariants = queries.filter(Boolean).map((q) => tokenize(q));

  const scored: Passage[] = all.map((passage, i) => {
    let best = 0;
    for (const q of queryVariants) {
      const s = bm25Score(q, all[i].tokens, idf, avgdl);
      if (s > best) best = s;
    }
    return { url: passage.url, index: passage.index, text: passage.text, score: best };
  });

  // BM25 IDF degenerates on a tiny corpus: with two or three passages every term
  // has nearly the same IDF and the scores collapse. When nothing discriminates,
  // keep document order rather than an arbitrary one.
  const discriminates = scored.some((p) => p.score > 0);
  if (discriminates) scored.sort((a, b) => b.score - a.score);

  // Cap per page so one long article cannot monopolise the context window.
  const perPage = new Map<string, number>();
  const kept: Passage[] = [];
  for (const passage of scored) {
    const count = perPage.get(passage.url) ?? 0;
    if (count >= opts.maxPerPage) continue;
    perPage.set(passage.url, count + 1);
    kept.push(passage);
    if (kept.length >= opts.maxTotal) break;
  }

  // Restore document order within each page: a model reading two passages of the
  // same article should see them in the order the author wrote them.
  //
  // Consequence for callers: the returned ARRAY ORDER is no longer the ranking.
  // The cut has already happened above, so this is intended — but read `.score`,
  // never the index, if you need the ranking.
  return kept.sort((a, b) => (a.url === b.url ? a.index - b.index : 0));
}
