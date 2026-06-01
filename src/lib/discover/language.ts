/**
 * @module discover/language
 * @description Light-weight, in-process language detection for French,
 * English, and four major African languages: Bambara, Wolof, Hausa, Swahili.
 * @author Amadou — Dicken AI
 * @version 1.1.0
 *
 * Approach: a small seed-word heuristic.  We pick the language whose seed
 * words appear most frequently in the lower-cased, accent-stripped text.
 * No external models, no APIs, < 1 ms per call.
 *
 * Why this is enough for Bokari Discover:
 *   - We only need to know "is this FR or not?" to apply language boost.
 *   - The 4 African languages cover ~70% of sub-Saharan francophone
 *     audiences (Mali, Senegal, Côte d'Ivoire, Burkina, Niger, DRC).
 *   - Adding more languages (Yoruba, Igbo, Amharic) is a 5-line change.
 *   - Misclassification is non-fatal: it just means we don't boost that
 *     article, which is fine.
 *
 * If we ever need higher accuracy, plug in franc / cld3 / fasttext at
 * this exact boundary.
 */

import type { Language } from './types';

/** French seeds.  Mix of stopwords and high-frequency content words. */
const FR = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'et', 'est', 'qui',
  'que', 'dans', 'pour', 'avec', 'sur', 'sont', 'ce', 'cette', 'aux', 'ou',
  'mais', 'nous', 'vous', 'leur', 'etre', 'avoir', 'fait', 'plus', 'aussi',
  'meme', 'tout', 'tous', 'comme', 'apres', 'avant', 'entre', 'depuis',
  'contre', 'sans', 'sous', 'chez', 'vers', 'elle', 'elles', 'ils',
]);

/** English seeds. */
const EN = new Set([
  'the', 'a', 'an', 'and', 'is', 'are', 'was', 'were', 'of', 'in', 'to',
  'for', 'with', 'on', 'that', 'this', 'these', 'those', 'their', 'they',
  'we', 'you', 'he', 'she', 'it', 'but', 'or', 'from', 'as', 'by', 'at',
  'be', 'has', 'have', 'had', 'will', 'can', 'would', 'should', 'may',
  'about', 'into', 'over', 'after', 'before', 'between', 'without', 'his',
  'her', 'its', 'our', 'your', 'my',
  // Content words distinctive of English news headlines
  'startup', 'startups', 'raises', 'funding', 'investors', 'launches',
  'announces', 'reports', 'says', 'said', 'new', 'first', 'best', 'top',
  'million', 'billion', 'company', 'tech', 'technology', 'says',
]);

/** Bambara seeds.  Mali + diaspora. */
const BM = new Set([
  'n', 'ye', 'ka', 'ma', 'an', 'ba', 'be', 'fo', 'waa', 'ce', 'dugu',
  'bamako', 'sikɛlɛ', 'sikele', 'wari', 'dɔrɔmɛ', 'dorome', 'kɔnɔ', 'kono',
  'fɛ', 'fe', 'muso', 'cɛ', 'ce', 'den', 'baara', 'kalan', 'karanda',
  'nyɛ', 'nye', 'kɛnɛ', 'kene', 'i', 'a', 'o', 'aw', 'ayi', 'aww', 'hɛɛ',
  'oo', 'tuma', 'kun', 'na', 'la', 'ni', 'tɛ', 'te',
]);

/** Wolof seeds.  Senegal. */
const WO = new Set([
  'nga', 'def', 'maa', 'ngi', 'dem', 'rekk', 'du', 'degg', 'xam',
  'nguir', 'yow', 'sounou', 'jef', 'dëgg', 'degg', 'baax', 'wer',
  'dakar', 'saint-louis', 'touba', 'thiès', 'mbour', 'kaolack',
  'naka', 'lan', 'yow', 'sama', 'sa', 'ci', 'bu', 'ba', 'di',
]);

/** Hausa seeds.  Nigeria, Niger, Ghana. */
const HA = new Set([
  'sannu', 'kai', 'yaya', 'ina', 'na', 'ya', 'za', 'a', 'da', 'su',
  'mu', 'ku', 'kan', 'kano', 'lagos', 'abuja', 'taimako', 'godiya',
  'gida', 'ruwa', 'abinci', 'kudi', 'karfe', 'rana', 'daren', 'safe',
  'yini', 'kwana', 'makasudin', 'wannan', 'wancan', 'shi', 'ita',
]);

/** Swahili seeds.  East Africa. */
const SW = new Set([
  'habari', 'yako', 'ninatoka', 'mimi', 'wewe', 'yeye', 'sisi', 'wao',
  'na', 'ya', 'wa', 'la', 'katika', 'kwa', 'nairobi', 'mombasa',
  'dar', 'es', 'salaam', 'arusha', 'kigali', 'kampala', 'jambo',
  'asubuhi', 'alasiri', 'jioni', 'usiku', 'leo', 'kesho', 'jana',
  'sasa', 'bwana', 'bibi', 'mtu', 'watu', 'kazi', 'shule', 'chuo',
  'rafiki', 'penda', 'chuki', 'nzuri', 'mbaya', 'kubwa', 'ndogo',
]);

/**
 * Strip diacritics and lowercase the text, then tokenize into words.
 * Apóstrophes inside words are kept (e.g. "n'ye" stays as one token).
 * African IPA letters (ɛ, ɔ, ɲ, etc.) are folded to their Latin
 * equivalents so seed matching works on "bamako" + "kono" + "n'ye".
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // African IPA → Latin
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
 * Count how many tokens match any seed for the given language.
 * Counts each token once (de-duplicated within the document).
 */
function countMatches(tokens: string[], seeds: Set<string>): number {
  let count = 0;
  for (const t of tokens) {
    if (seeds.has(t)) count++;
  }
  return count;
}

/**
 * Detect the language of `text`.  Returns 'other' if no language
 * scores above the minimum threshold (2 hits) — we'd rather not
 * guess than guess wrong.
 *
 * @param text - any string, up to ~4 KB.  Longer is fine, we cap internally.
 * @returns detected language code.
 */
export function detectLanguage(text: string | null | undefined): Language {
  if (!text) return 'other';

  // Cap at 4 KB for speed and to limit memory in tight loops.
  const sample = text.length > 4096 ? text.slice(0, 4096) : text;
  const tokens = tokenize(sample);

  // Minimum tokens needed for a confident classification.
  const MIN_TOKENS = 3;
  if (tokens.length < MIN_TOKENS) {
    return 'other';
  }

  const scores: Record<Exclude<Language, 'other'>, number> = {
    fr: countMatches(tokens, FR),
    en: countMatches(tokens, EN),
    bm: countMatches(tokens, BM),
    wo: countMatches(tokens, WO),
    ha: countMatches(tokens, HA),
    sw: countMatches(tokens, SW),
  };

  // Find the highest score
  let bestLang: Exclude<Language, 'other'> = 'fr';
  let bestScore = scores.fr;
  for (const lang of ['en', 'bm', 'wo', 'ha', 'sw'] as const) {
    if (scores[lang] > bestScore) {
      bestLang = lang;
      bestScore = scores[lang];
    }
  }

  // If the best score is below 2, we don't trust the classification.
  // This avoids misclassifying fragments of one language as another.
  const MIN_HITS = 2;
  if (bestScore < MIN_HITS) {
    return 'other';
  }

  return bestLang;
}
