/**
 * @module eval/dataset
 * @description 20 fixed African queries with derived relevance grades.
 *
 * These are the queries we use to evaluate the citation engine.  We
 * deliberately use a small, hand-curated set (20) so we can re-run
 * the eval cheaply on every change and inspect failures.
 *
 * Relevance grades are derived from the candidate set, not human-
 * rated.  For each query, the grader scores article relevance using
 * *token overlap* (case-insensitive, with stopwords removed):
 *
 *   rel=3: ≥50% of distinct query tokens appear in the title, OR
 *          a `mustMatch` term appears in the title.
 *   rel=2: ≥30% of distinct query tokens appear in the title.
 *   rel=1: any query token or `mustMatch` appears in the body only.
 *   rel=0: topic gate fails, or no overlap.
 *
 * This is a noisy proxy for "would a human say this is relevant?"
 * — but it gives a directional signal for BM25 vs hybrid comparison
 * without paying for human grading.  As we collect real user feedback
 * (Phase 6), we'll swap the derived grades for human ratings.
 *
 * @author Amadou — Dicken AI
 * @version 1.1.0
 */

export type EvalQuery = {
  /** The natural-language query. */
  query: string;
  /** Optional topic filter, matches `Article.topic` (lowercase). */
  topic?: 'africa' | 'tech' | 'finance' | 'art' | 'sports' | 'politics' | 'sante';
  /**
   * Substrings (case-insensitive) that mark an article as
   * highly-relevant.  Match in title = rel=3, match in body only =
   * rel=1.  Empty = the relevance grades are fully derived from
   * the query string itself.
   */
  mustMatch?: string[];
  /**
   * Words that must NOT appear in title (otherwise the article is
   * marked irrelevant).  Used to filter out topic-adjacent articles
   * that would otherwise look relevant.  Optional.
   */
  forbiddenTitle?: string[];
  /** Free-form notes — what this query is testing. */
  notes?: string;
};

/**
 * 20 African-leaning queries, each tagged with a topic and
 * relevance hints.  Roughly balanced:
 *   - 8 Africa (politics, news, elections, conflicts)
 *   - 4 Tech (AI, startups, dev tools)
 *   - 4 Finance (BRVM, fintech, crypto, market data)
 *   - 2 Art (music, film)
 *   - 1 Sports (AFCON)
 *   - 1 Sante (public health)
 */
export const AFRICAN_EVAL_QUERIES: readonly EvalQuery[] = [
  // Africa — politics
  { query: 'Bamako Mali nouveau président', topic: 'africa', notes: 'Mali political transition' },
  { query: 'Nigeria election 2026', topic: 'africa', notes: 'Nigeria general election' },
  { query: 'Sahel security crisis', topic: 'africa', notes: 'Sahel-wide security situation' },
  { query: 'Sénégal Dakar actualité', topic: 'africa', notes: 'French Senegalese news' },
  { query: 'Ethiopia peace process', topic: 'africa', notes: 'Ethiopia reconciliation' },

  // Africa — economy
  { query: 'CFA franc BCEAO', topic: 'finance', notes: 'West African CFA franc' },
  { query: 'AfCFTA free trade', topic: 'finance', notes: 'African continental free trade area' },

  // Tech
  { query: 'African AI startup funding', topic: 'tech', notes: 'Tech investment in Africa' },
  { query: 'mobile money M-Pesa', topic: 'tech', notes: 'Mobile money' },
  { query: 'Flutterwave Paystack', topic: 'tech', notes: 'Nigerian fintech giants' },
  { query: 'African developer community', topic: 'tech', notes: 'African dev community' },

  // Finance
  { query: 'BRVM UEMOA stock exchange', topic: 'finance', notes: 'West African stock exchange' },
  { query: 'African crypto adoption', topic: 'finance', notes: 'Crypto uptake in Africa' },
  { query: 'microfinance rural Africa', topic: 'finance', notes: 'Rural microfinance' },

  // Art
  { query: 'Afrobeats Grammy nomination', topic: 'art', notes: 'Afrobeats mainstream breakthrough' },
  { query: 'Nollywood film industry', topic: 'art', notes: 'Nigerian film industry' },

  // Sports
  { query: 'AFCON 2026 Morocco', topic: 'sports', notes: 'Africa Cup of Nations' },

  // Sante
  { query: 'malaria vaccine Africa rollout', topic: 'sante', notes: 'RTS,S vaccine deployment' },

  // Cross-language (BGE-M3 is multilingual)
  { query: 'Mali président inauguration', topic: 'africa', notes: 'French-language test' },
  { query: 'Bamako n服的ceremony', topic: 'africa', notes: 'Cross-lang: Bambara-ish' },

  // Adversarial — paraphrase-heavy, lexical BM25 should struggle.
  {
    query: 'le nouveau dirigeant malien a prêté serment à Koulouba',
    topic: 'africa',
    mustMatch: ['koulouba'],
    notes: 'Paraphrase of fixture-031 — BM25 misses it, cosine should match',
  },
  {
    query: 'African artificial intelligence startup raises capital',
    topic: 'tech',
    mustMatch: ['ai', 'startup', 'funding', 'capital'],
    notes: 'English paraphrase — should match fixture-009 not fixture-030 (fintech)',
  },
  {
    query: 'machine learning Africa venture investment',
    topic: 'tech',
    mustMatch: ['ai', 'startup'],
    notes: 'Cross-vocab: ML/venture/AI — cosine should bridge to fixture-009',
  },
];

export type DerivedRelevance = 0 | 1 | 2 | 3;

const STOPWORDS = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'au', 'aux',
  'a', 'et', 'ou', 'en', 'on', 'il', 'elle', 'ils', 'elles',
  'the', 'a', 'an', 'of', 'in', 'on', 'at', 'to', 'for', 'and', 'or',
  'is', 'are', 'was', 'were', 'be', 'been',
]);

function tokensOf(s: string): string[] {
  return (s.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []).filter(
    (t) => t.length >= 2 && !STOPWORDS.has(t),
  );
}

/**
 * Compute a per-article relevance grade for a single query.
 * Returns 0 if the article is irrelevant.
 *
 * The grader uses *token overlap*, not exact-string match.  This is
 * what makes BM25 look good on this eval (it scores highly when
 * query tokens appear in title) while also leaving room for cosine
 * to help (cross-language, paraphrase, semantically related).
 *
 * Rules (in priority order):
 *   - 0 if the article's topic doesn't match the query's topic
 *     (when the query specifies a topic) AND no mustMatch is in the title.
 *   - 0 if any `forbiddenTitle` substring is in the title.
 *   - 3 if ≥50% of the query's distinct tokens are in the title, OR
 *     any mustMatch is in the title.
 *   - 2 if ≥30% of the query's distinct tokens are in the title.
 *   - 1 if any query token is in the body, OR any mustMatch is in body.
 *   - 0 otherwise.
 */
export function deriveRelevance(
  query: EvalQuery,
  article: { title: string; fullContent?: string | null; topic: string },
): DerivedRelevance {
  const title = (article.title || '').toLowerCase();
  const body = (article.fullContent || '').toLowerCase();
  const distinctQueryTokens = Array.from(new Set(tokensOf(query.query)));

  // Topic gate.
  if (query.topic && article.topic && article.topic.toLowerCase() !== query.topic) {
    const hasMustMatchInTitle =
      query.mustMatch?.some((m) => title.includes(m.toLowerCase())) ?? false;
    if (!hasMustMatchInTitle) return 0;
  }

  // Forbidden terms.
  if (query.forbiddenTitle && query.forbiddenTitle.length > 0) {
    for (const f of query.forbiddenTitle) {
      if (title.includes(f.toLowerCase())) return 0;
    }
  }

  // mustMatch in title → 3.
  if (query.mustMatch && query.mustMatch.length > 0) {
    for (const m of query.mustMatch) {
      if (title.includes(m.toLowerCase())) return 3;
    }
  }

  // Token overlap with title.
  if (distinctQueryTokens.length > 0) {
    const titleTokens = new Set(tokensOf(title));
    const hits = distinctQueryTokens.filter((t) => titleTokens.has(t));
    const ratio = hits.length / distinctQueryTokens.length;
    if (ratio >= 0.5) return 3;
    if (ratio >= 0.3) return 2;
  }

  // mustMatch or any query token in body → 1.
  if (query.mustMatch && query.mustMatch.length > 0) {
    for (const m of query.mustMatch) {
      if (body.includes(m.toLowerCase())) return 1;
    }
  }
  if (distinctQueryTokens.length > 0) {
    const bodyTokens = new Set(tokensOf(body));
    for (const t of distinctQueryTokens) {
      if (bodyTokens.has(t)) return 1;
    }
  }

  return 0;
}
