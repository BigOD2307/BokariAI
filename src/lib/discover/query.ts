/**
 * @module discover/query
 * @description Query understanding for the Discover pipeline.
 * @author Amadou — Dicken AI
 * @version 1.0.0
 *
 * Three jobs:
 *   1. Classify what the user is after (news / research / local / mixed).
 *   2. Expand the query into 2-4 variants so the search engines see
 *      multiple angles of the same intent.
 *   3. Detect whether the query has African context (drives the
 *      African-source boost downstream).
 *
 * Why not an LLM?  These are deterministic, sub-millisecond operations
 * that run on every Discover request.  A model call would cost > 100 ms
 * and money we don't need to spend for keyword-level heuristics.
 *
 * The expansion strategy is simple: synonyms + topic-specific phrases.
 * When we later add embeddings, expansion will become smarter.
 */

import type { QueryIntent, Topic } from './types';

/**
 * Normalize a query string for matching: lowercase + remove diacritics
 * + collapse whitespace. Used by the deterministic classifiers so that
 * "Sénégal" / "senegal" / "SENEGAL" all match the same marker.
 */
export function normalizeQuery(query: string): string {
  return query
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Keyword-based intent classifier.
 * News wins when the query has time-bound words. Research wins when
 * the query has explanatory words. Local wins for "near me" + cities.
 * Otherwise: mixed.
 */
const NEWS_HINTS = [
  'actualit', 'news', 'aujourd', 'today', 'hier', 'yesterday',
  'dernier', 'last', 'breaking', 'urgent', 'match', 'score',
  'resultat', 'result', 'election', 'vote', 'annon', 'announce',
  'lance', 'launch', 'declar', 'declare', 'selon', 'according',
];

const RESEARCH_HINTS = [
  'comment', 'how', 'pourquoi', 'why', 'expliqu', 'explain',
  'fonctionn', 'function', 'definition', 'définition', 'difference',
  'différence', 'avantages', 'advantages', 'inconvénients', 'disadvantages',
  'guide', 'tutoriel', 'tutorial', 'apprendre', 'learn', 'histoire',
  'history', 'origines', 'origins',
];

const LOCAL_HINTS = [
  'près de moi', 'near me', 'autour', 'around', 'adresse', 'address',
  'où trouver', 'where to find', 'horaires', 'hours', 'ouvert',
  'restaurant', 'pharmacie', 'pharmacy', 'hôpital', 'hospital',
  'météo', 'weather', 'bamako', 'dakar', 'abidjan', 'ouagadougou',
  'niamey', 'lomé', 'cotonou', 'kinshasa', 'douala', 'yaoundé',
  'libreville', 'brazzaville', 'kampala', 'kigali', 'dodoma',
];

/** African country / region markers. Lowercased substrings. */
const AFRICAN_MARKERS = [
  // Francophone UEMOA / CEMAC
  'senegal', 'mali', 'côte d\'ivoire', 'cote d\'ivoire', 'burkina',
  'niger', 'togo', 'benin', 'guinee', 'guinea', 'mauritanie', 'mauritania',
  // Anglophone West Africa
  'nigeria', 'ghana', 'sierra leone', 'liberia', 'gambia', 'cape verde',
  // Central Africa
  'cameroun', 'cameroon', 'rdc', 'drc', 'congo', 'tchad', 'chad',
  'centrafrique', 'central african', 'gabon', 'guinee equatoriale',
  // East Africa
  'kenya', 'uganda', 'tanzania', 'rwanda', 'burundi', 'ethiopia',
  'ethiopie', 'somalie', 'somalia', 'soudan', 'sudan', 'south sudan',
  // Southern Africa
  'afrique du sud', 'south africa', 'zimbabwe', 'zambia', 'botswana',
  'mozambique', 'angola', 'namibia', 'lesotho', 'eswatini', 'malawi',
  // North Africa (also relevant for francophone)
  'maroc', 'morocco', 'algerie', 'algeria', 'tunisie', 'tunisia',
  'libye', 'libya', 'egypte', 'egypt',
  // Capitals (in case country name is omitted)
  'dakar', 'bamako', 'abidjan', 'ouagadougou', 'niamey', 'lome', 'cotonou',
  'conakry', 'nouakchott', 'yaounde', 'douala', 'kinshasa', 'brazzaville',
  'libreville', 'kampala', 'kigali', 'dodoma', 'nairobi', 'addis',
  'johannesburg', 'cape town', 'casablanca', 'rabat', 'alger', 'tunis',
  // Regional / pan-African
  'afrique', 'africa', 'african', 'africain', 'uemoa', 'cemac', 'cedeao',
  'ecowas', 'brvm', 'african union', 'union africaine', 'ua',
  'cfa', 'fcfa', 'xof', 'xaf',
  // Major African cities / regions (English)
  'lagos', 'accra', 'freetown', 'monrovia', 'banjul',
];

/**
 * Classify the query intent.
 */
export function classifyQuery(query: string, _topic: Topic): QueryIntent {
  if (!query || query.trim().length < 2) return 'mixed';

  const q = normalizeQuery(query);

  let newsScore = 0;
  let researchScore = 0;
  let localScore = 0;

  for (const hint of NEWS_HINTS) {
    if (q.includes(hint)) newsScore++;
  }
  for (const hint of RESEARCH_HINTS) {
    if (q.includes(hint)) researchScore++;
  }
  for (const hint of LOCAL_HINTS) {
    if (q.includes(hint)) localScore++;
  }

  // Tie-breaking: news > research > local > mixed
  if (newsScore > 0 && newsScore >= researchScore && newsScore >= localScore) {
    return 'news';
  }
  if (researchScore > 0 && researchScore >= localScore) {
    return 'research';
  }
  if (localScore > 0) {
    return 'local';
  }
  return 'mixed';
}

/**
 * Synonym / phrase tables per topic.  Used to expand the user's query
 * into multiple search variants.
 */
const TOPIC_EXPANSIONS: Record<Topic, string[]> = {
  africa: [
    'Afrique',
    'actualite Afrique',
    'news Africa',
  ],
  tech: [
    'technologie Afrique',
    'innovation Afrique',
    'startup Africa',
    'intelligence artificielle Afrique',
    'AI Africa',
  ],
  finance: [
    'economie Afrique',
    'finance Afrique',
    'BRVM UEMOA',
    'bourse Afrique',
    'investissement Afrique',
    'FCFA',
  ],
  art: [
    'culture africaine',
    'musique africaine',
    'cinema africain',
    'art contemporain Afrique',
  ],
  sports: [
    'football africain',
    'CAN',
    'sport Afrique',
    'athletes africains',
  ],
  politics: [
    'politique Afrique',
    'elections Afrique',
    'geopolitique Afrique',
    'union africaine',
  ],
  sante: [
    'sante Afrique',
    'OMS Afrique',
    'sante publique Afrique',
    'epidemie Afrique',
  ],
};

/**
 * FR ↔ EN synonym pairs.  Used when the input is FR and we want to
 * fire some queries in EN (and vice versa) for broader coverage.
 */
const FR_EN_SYNONYMS: Array<[string, string]> = [
  ['intelligence artificielle', 'artificial intelligence'],
  ['ia', 'ai'],
  ['recherche', 'research'],
  ['startup', 'startup'],
  ['economie', 'economy'],
  ['finance', 'finance'],
  ['bourse', 'stock market'],
  ['football', 'football'],
  ['sante', 'health'],
  ['education', 'education'],
  ['climat', 'climate'],
  ['energie', 'energy'],
  ['agriculture', 'agriculture'],
];

/**
 * Expand the query into 2-4 variants.
 *
 * Strategy:
 *   1. Always include the original query.
 *   2. Append a topic-default variant.
 *   3. If FR: produce one EN variant using FR→EN synonym map.
 *   4. If EN: produce one FR variant using EN→FR reverse map.
 *
 * @returns 2-4 unique strings, deterministically ordered.
 */
export function expandQuery(query: string, topic: Topic, lang: 'fr' | 'en'): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  const push = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(trimmed);
  };

  // 1. Original
  push(query);

  // 2. Topic-default variant (cycle through)
  const topicExps = TOPIC_EXPANSIONS[topic] ?? [];
  if (topicExps.length > 0) {
    push(`${query} ${topicExps[0]}`);
  }

  // 3. Synonym swap (FR↔EN) when it actually changes something.
  // Case-insensitive + diacritics-stripped so "Économie" matches "economie".
  const qLower = normalizeQuery(query);
  if (lang === 'fr') {
    for (const [fr, en] of FR_EN_SYNONYMS) {
      if (qLower.includes(fr)) {
        push(query.replace(new RegExp(fr, 'i'), en));
        break; // one swap is enough
      }
    }
  } else {
    for (const [fr, en] of FR_EN_SYNONYMS) {
      if (qLower.includes(en)) {
        push(query.replace(new RegExp(en, 'i'), fr));
        break;
      }
    }
  }

  // 4. If still only 1 result, add a year-tagged news variant
  if (out.length === 1) {
    const year = new Date().getFullYear();
    push(`${query} ${year} actualite`);
  }

  // Cap at 4 to keep search-engine latency reasonable
  return out.slice(0, 4);
}

/**
 * Detect African context in a query (any language, case-insensitive,
 * diacritics-stripped).  Returns true if any African country, city,
 * or regional marker is found.
 */
export function isAfricanContext(query: string): boolean {
  if (!query) return false;
  const q = normalizeQuery(query);
  for (const marker of AFRICAN_MARKERS) {
    if (q.includes(marker)) return true;
  }
  return false;
}
