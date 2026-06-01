/**
 * @module discover/bm25
 * @description BM25 (Best Matching 25) text-similarity scorer.
 * @author Amadou — Dicken AI
 * @version 1.0.0
 *
 * BM25 is the workhorse of lexical search.  It's been the default
 * ranking function in Elasticsearch, Lucene, Solr, and OpenSearch for
 * 30 years.  It's fast, it doesn't need a GPU, and for our volume
 * (50-100 articles per topic) it finishes in microseconds.
 *
 * Why BM25 over TF-IDF?  BM25 normalizes by document length and has
 * tunable saturation (k1) and length normalization (b) parameters that
 * make it much less sensitive to long documents.  Real-world ranking
 * needs that.
 *
 * Why not embeddings?  Phase 3.  We don't have an embedding service
 * wired up yet.  When we do, we'll combine BM25 + cosine (the "hybrid"
 * in hybrid retrieval) using RRF fusion.
 *
 * Reference: Robertson, S. & Zaragoza, H. (2009).
 * "The Probabilistic Relevance Framework: BM25 and Beyond."
 */

const K1_DEFAULT = 1.5;
const B_DEFAULT = 0.75;

/**
 * French / multilingual-aware tokenizer.
 * - Lowercase
 * - Strip diacritics
 * - Remove punctuation (keep apostrophes inside words)
 * - Fold African IPA to Latin (ɔ→o, ɛ→e, ɲ→ny, etc.)
 * - Split on whitespace
 */
export function tokenize(text: string): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[ɛẹ]/g, 'e')
    .replace(/[ɔọ]/g, 'o')
    .replace(/ɲ/g, 'ny')
    .replace(/ŋ/g, 'ng')
    .replace(/ɓ/g, 'b')
    .replace(/ɗ/g, 'd')
    .replace(/[‘’]/g, "'")
    .replace(/[^\w\s'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter((w) => w.length > 0);
}

/**
 * Term frequency in a single document.
 */
function termFreq(doc: string[], term: string): number {
  let n = 0;
  for (const t of doc) if (t === term) n++;
  return n;
}

/**
 * Pre-compute the corpus-wide statistics needed for BM25:
 *   - idf(t) = log((N - df + 0.5) / (df + 0.5) + 1)
 *     (with the +1 inside the log so IDF is always >= 0)
 *   - avgdl = mean document length in tokens
 *
 * @param docs - already-tokenized documents
 */
export function buildBM25Index(docs: string[][]): {
  idf: Map<string, number>;
  avgdl: number;
} {
  const N = docs.length;
  const df = new Map<string, number>();
  let totalLen = 0;

  for (const doc of docs) {
    totalLen += doc.length;
    const seen = new Set<string>();
    for (const term of doc) {
      if (seen.has(term)) continue;
      seen.add(term);
      df.set(term, (df.get(term) ?? 0) + 1);
    }
  }

  const idf = new Map<string, number>();
  for (const [term, dfreq] of df) {
    // Standard BM25 IDF with the +1 inside the log so terms that
    // appear in every document still get a positive score.
    const score = Math.log((N - dfreq + 0.5) / (dfreq + 0.5) + 1);
    idf.set(term, score);
  }

  return { idf, avgdl: N === 0 ? 0 : totalLen / N };
}

/**
 * Compute the BM25 score of a single document against a query.
 *
 * Score is the sum over query terms of:
 *   idf(t) * (tf(t,d) * (k1 + 1)) / (tf(t,d) + k1 * (1 - b + b * |d|/avgdl))
 *
 * @param query - tokenized query terms
 * @param doc   - tokenized document
 * @param idf   - term → IDF map (from buildBM25Index)
 * @param avgdl - average document length in tokens (from buildBM25Index)
 * @param k1    - term frequency saturation (default 1.5)
 * @param b     - length normalization (default 0.75; 0 = none, 1 = full)
 */
export function bm25Score(
  query: string[],
  doc: string[],
  idf: Map<string, number>,
  avgdl: number,
  k1: number = K1_DEFAULT,
  b: number = B_DEFAULT,
): number {
  if (query.length === 0 || doc.length === 0) return 0;
  // Guard: if the index is empty we have no IDF values, so the score
  // would be 0 for every term.  Returning 0 is correct.
  if (avgdl === 0) return 0;

  const docLen = doc.length;
  let score = 0;

  for (const term of query) {
    const tf = termFreq(doc, term);
    if (tf === 0) continue;
    const idfVal = idf.get(term) ?? 0;
    if (idfVal === 0) continue;
    const numerator = tf * (k1 + 1);
    const denominator = tf + k1 * (1 - b + (b * docLen) / avgdl);
    score += idfVal * (numerator / denominator);
  }

  return score;
}
