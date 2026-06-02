/**
 * @module eval/fixture
 * @description A small synthetic Bokari corpus used by the eval
 * harness.  30 articles, hand-written to cover the 20 African
 * eval queries with a mix of relevant and irrelevant entries.
 *
 * Why a fixture?  Running the eval against a real Supabase corpus
 * would couple the eval to data state — every refresh would change
 * the numbers.  A fixture gives us:
 *   - reproducibility (same numbers every run)
 *   - fast iteration (no network, no Supabase)
 *   - a known ground truth (we hand-wrote the articles)
 *
 * The fixture is intentionally small (30 articles).  Real corpora
 * will be 1000× larger; the eval will still produce meaningful
 * relative-comparison numbers.
 *
 * In Phase 6 we may add a "live" mode that pulls the most recent
 * 500 embedded articles from Supabase and runs the same eval.
 *
 * @author Amadou — Dicken AI
 * @version 1.0.0
 */

import type { Article } from '@/lib/discover/types';

const NOW = new Date('2026-06-01T12:00:00Z');
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function makeArticle(overrides: Partial<Article> = {}): Article {
  return {
    id: 'fixture-' + Math.random().toString(36).slice(2, 8),
    topic: 'africa',
    title: 'Untitled',
    content: 'Content',
    url: 'https://example.com/' + Math.random().toString(36).slice(2, 8),
    thumbnail: null,
    domain: 'example.com',
    language: 'fr',
    publishedAt: NOW,
    author: null,
    qualityScore: 0.7,
    createdAt: NOW,
    embedding: null,
    ...overrides,
  };
}

export const FIXTURE_CORPUS: Article[] = [
  // Africa — Mali
  makeArticle({
    topic: 'africa',
    title: 'Bamako : le nouveau président du Mali prête serment',
    content:
      'Le nouveau président de la transition malienne a prêté serment mardi à Bamako devant la Cour constitutionnelle. Discours inaugural, cérémonie sobre, place de l\'Indépendance noire de monde. Le Mali entre dans une nouvelle ère politique après des mois d\'incertitude. Les observateurs saluent le retour au dialogue.',
    url: 'https://rfi.fr/bamako-president-serment',
    domain: 'rfi.fr',
    language: 'fr',
    publishedAt: new Date(NOW.getTime() - 1 * ONE_DAY_MS),
  }),
  makeArticle({
    topic: 'africa',
    title: 'Mali : Assimi Goïta confirme la prolongation de la transition',
    content:
      'Bamako — Le colonel Assimi Goïta a confirmé la prolongation de la transition pour deux ans supplémentaires. La communauté internationale reste divisée sur la question.',
    url: 'https://bbc.com/mali-transition',
    domain: 'bbc.com',
    language: 'fr',
    publishedAt: new Date(NOW.getTime() - 5 * ONE_DAY_MS),
  }),

  // Africa — Nigeria
  makeArticle({
    topic: 'africa',
    title: 'Nigeria election 2026 : Tinubu faces fresh challenges',
    content:
      'Abuja — As Nigeria heads into the 2026 general elections, President Bola Tinubu faces a wave of opposition. The economy, security in the north, and currency reform dominate the debate.',
    url: 'https://thecable.ng/nigeria-2026',
    domain: 'thecable.ng',
    language: 'en',
    publishedAt: new Date(NOW.getTime() - 3 * ONE_DAY_MS),
  }),
  makeArticle({
    topic: 'africa',
    title: 'Lagos tech hub attracts new investment',
    content:
      'Y Combinator and other VCs are turning their attention to Lagos as Africa\'s startup scene continues to grow.',
    url: 'https://techcabal.com/lagos-yc',
    domain: 'techcabal.com',
    language: 'en',
    publishedAt: new Date(NOW.getTime() - 7 * ONE_DAY_MS),
  }),

  // Africa — Sahel
  makeArticle({
    topic: 'africa',
    title: 'Sahel security crisis : JNIM expands operations',
    content:
      'The Group for Supporting Islam and Muslims (JNIM) has expanded its operations across the Sahel, raising fears of a wider regional security crisis. Mali, Burkina Faso, and Niger are the most affected.',
    url: 'https://france24.com/sahel-jnim',
    domain: 'france24.com',
    language: 'en',
    publishedAt: new Date(NOW.getTime() - 2 * ONE_DAY_MS),
  }),

  // Africa — Senegal
  makeArticle({
    topic: 'africa',
    title: 'Sénégal : Diomaye Faye et Sonko au cœur de l\'actualité',
    content:
      'Dakar — Le président Bassirou Diomaye Faye et son Premier ministre Ousmane Sonko dominent l\'actualité politique sénégalaise cette semaine avec plusieurs annonces sur la souveraineté monétaire.',
    url: 'https://seneweb.com/diomaye-sonko',
    domain: 'seneweb.com',
    language: 'fr',
    publishedAt: new Date(NOW.getTime() - 4 * ONE_DAY_MS),
  }),

  // Africa — Ethiopia
  makeArticle({
    topic: 'africa',
    title: 'Ethiopia peace process : Addis Ababa signs new agreement',
    content:
      'The Ethiopian government and regional leaders signed a new peace agreement aimed at ending years of conflict in the north of the country.',
    url: 'https://addisstandard.com/peace-process',
    domain: 'addisstandard.com',
    language: 'en',
    publishedAt: new Date(NOW.getTime() - 6 * ONE_DAY_MS),
  }),

  // Finance — CFA franc
  makeArticle({
    topic: 'finance',
    title: 'CFA franc : la BCEAO maintient le taux directeur',
    content:
      'La Banque Centrale des États de l\'Afrique de l\'Ouest (BCEAO) a maintenu son taux directeur à 3,5%, signalant une pause dans le cycle de resserrement monétaire.',
    url: 'https://financialafrik.com/bceao-taux',
    domain: 'financialafrik.com',
    language: 'fr',
    publishedAt: new Date(NOW.getTime() - 8 * ONE_DAY_MS),
  }),

  // Finance — AfCFTA
  makeArticle({
    topic: 'finance',
    title: 'AfCFTA free trade : 5 years of uneven progress',
    content:
      'The African Continental Free Trade Area (AfCFTA) marks five years since its launch. Trade has grown but tariff and non-tariff barriers remain.',
    url: 'https://african.business/afcfta',
    domain: 'african.business',
    language: 'en',
    publishedAt: new Date(NOW.getTime() - 10 * ONE_DAY_MS),
  }),

  // Tech — AI startups
  makeArticle({
    topic: 'tech',
    title: 'African AI startups raise $1.2B in 2025',
    content:
      'African AI startups attracted a record $1.2B in venture funding in 2025, with Lagos, Nairobi, and Cape Town leading. The growth is driven by fintech and healthtech applications.',
    url: 'https://disrupt-africa.com/ai-funding',
    domain: 'disrupt-africa.com',
    language: 'en',
    publishedAt: new Date(NOW.getTime() - 12 * ONE_DAY_MS),
  }),

  // Tech — M-Pesa
  makeArticle({
    topic: 'tech',
    title: 'M-Pesa crosses 50 million active users across East Africa',
    content:
      'Safaricom\'s M-Pesa mobile money platform now serves over 50 million active monthly users across Kenya, Tanzania, DRC, and beyond.',
    url: 'https://techpoint.africa/m-pesa-50m',
    domain: 'techpoint.africa',
    language: 'en',
    publishedAt: new Date(NOW.getTime() - 9 * ONE_DAY_MS),
  }),

  // Tech — Flutterwave / Paystack
  makeArticle({
    topic: 'tech',
    title: 'Flutterwave and Paystack dominate African payments',
    content:
      'Nigerian fintechs Flutterwave and Paystack continue to dominate cross-border payments across Africa, processing billions in volume annually.',
    url: 'https://techcrunch.com/flutterwave-paystack',
    domain: 'techcrunch.com',
    language: 'en',
    publishedAt: new Date(NOW.getTime() - 14 * ONE_DAY_MS),
  }),

  // Tech — Dev community
  makeArticle({
    topic: 'tech',
    title: 'African developer community grows 40% year-over-year',
    content:
      'The African developer community grew 40% YoY according to the latest GitHub Octoverse report. Lagos, Cairo, and Nairobi are top contributors.',
    url: 'https://github.blog/octoverse-africa',
    domain: 'github.blog',
    language: 'en',
    publishedAt: new Date(NOW.getTime() - 11 * ONE_DAY_MS),
  }),

  // Finance — BRVM
  makeArticle({
    topic: 'finance',
    title: 'BRVM UEMOA : le marché actions progresse de 8% en 2026',
    content:
      'La Bourse Régionale des Valeurs Mobilières (BRVM) de l\'UEMOA a progressé de 8% depuis le début de l\'année 2026, portée par les secteurs bancaire et télécom.',
    url: 'https://brvm.org/marche-2026',
    domain: 'brvm.org',
    language: 'fr',
    publishedAt: new Date(NOW.getTime() - 13 * ONE_DAY_MS),
  }),

  // Finance — Crypto
  makeArticle({
    topic: 'finance',
    title: 'African crypto adoption : Nigeria leads the continent',
    content:
      'Nigeria leads Africa in peer-to-peer Bitcoin trading volume, followed by South Africa and Kenya. Stablecoins are increasingly used for cross-border remittances.',
    url: 'https://chainalysis.com/africa-2025',
    domain: 'chainalysis.com',
    language: 'en',
    publishedAt: new Date(NOW.getTime() - 15 * ONE_DAY_MS),
  }),

  // Finance — Microfinance
  makeArticle({
    topic: 'finance',
    title: 'Microfinance transforms rural Africa',
    content:
      'Microfinance institutions in rural Africa have disbursed over $12B in small loans in 2025, transforming agricultural and small-business finance.',
    url: 'https://nextbillion.net/microfinance',
    domain: 'nextbillion.net',
    language: 'en',
    publishedAt: new Date(NOW.getTime() - 16 * ONE_DAY_MS),
  }),

  // Art — Afrobeats
  makeArticle({
    topic: 'art',
    title: 'Afrobeats Grammy nomination : Burna Boy and Wizkid lead',
    content:
      'Burna Boy, Wizkid, Tems, and Rema lead the Afrobeats Grammy nominations for 2026, marking the genre\'s continued mainstream breakthrough.',
    url: 'https://okayafrica.com/grammy-2026',
    domain: 'okayafrica.com',
    language: 'en',
    publishedAt: new Date(NOW.getTime() - 18 * ONE_DAY_MS),
  }),

  // Art — Nollywood
  makeArticle({
    topic: 'art',
    title: 'Nollywood film industry : the second-largest in the world',
    content:
      'Nollywood is the second-largest film industry in the world by volume, producing over 2,500 films per year. Streaming platforms are reshaping distribution.',
    url: 'https://variety.com/nollywood',
    domain: 'variety.com',
    language: 'en',
    publishedAt: new Date(NOW.getTime() - 20 * ONE_DAY_MS),
  }),

  // Sports — AFCON
  makeArticle({
    topic: 'sports',
    title: 'AFCON 2026 : le Maroc accueille la prochaine édition',
    content:
      'Le Maroc accueillera la prochaine Coupe d\'Afrique des Nations (AFCON 2026). Les préparatifs sont en cours dans les stades de Casablanca, Rabat, et Marrakech.',
    url: 'https://africanfootball.com/afcon-2026',
    domain: 'africanfootball.com',
    language: 'fr',
    publishedAt: new Date(NOW.getTime() - 22 * ONE_DAY_MS),
  }),

  // Sante — Malaria
  makeArticle({
    topic: 'sante',
    title: 'Malaria vaccine Africa rollout : RTS,S reaches 10 million children',
    content:
      'The RTS,S malaria vaccine has now reached over 10 million children across Ghana, Kenya, and Malawi. The WHO is expanding the rollout to nine more African countries in 2026.',
    url: 'https://who.int/malaria-vaccine',
    domain: 'who.int',
    language: 'en',
    publishedAt: new Date(NOW.getTime() - 24 * ONE_DAY_MS),
  }),

  // Decoys — irrelevant to the eval set (to make ranking non-trivial)
  makeArticle({
    topic: 'tech',
    title: 'Tesla unveils new self-driving chip',
    content: 'Tesla\'s new self-driving chip promises 10× performance.',
    url: 'https://reuters.com/tesla-chip',
    domain: 'reuters.com',
    language: 'en',
    publishedAt: new Date(NOW.getTime() - 30 * ONE_DAY_MS),
  }),
  makeArticle({
    topic: 'finance',
    title: 'Wall Street closes higher on rate cut hopes',
    content: 'The Dow and S&P 500 closed higher on Friday as investors bet on a rate cut.',
    url: 'https://bloomberg.com/wall-street',
    domain: 'bloomberg.com',
    language: 'en',
    publishedAt: new Date(NOW.getTime() - 28 * ONE_DAY_MS),
  }),
  makeArticle({
    topic: 'sports',
    title: 'NBA finals : Boston Celtics win Game 7',
    content: 'The Boston Celtics won the NBA finals in Game 7 against the Dallas Mavericks.',
    url: 'https://espn.com/nba-finals',
    domain: 'espn.com',
    language: 'en',
    publishedAt: new Date(NOW.getTime() - 25 * ONE_DAY_MS),
  }),
  makeArticle({
    topic: 'art',
    title: 'Cannes 2026 : African cinema shines',
    content: 'African films won three major prizes at the 2026 Cannes Film Festival.',
    url: 'https://screendaily.com/cannes-2026',
    domain: 'screendaily.com',
    language: 'en',
    publishedAt: new Date(NOW.getTime() - 21 * ONE_DAY_MS),
  }),
  makeArticle({
    topic: 'sante',
    title: 'WHO declares end of Marburg outbreak in Tanzania',
    content: 'The World Health Organization has declared the end of the Marburg virus outbreak in Tanzania.',
    url: 'https://who.int/marburg-tanzania',
    domain: 'who.int',
    language: 'en',
    publishedAt: new Date(NOW.getTime() - 27 * ONE_DAY_MS),
  }),
  makeArticle({
    topic: 'africa',
    title: 'Kenya : Ruto launches new affordable housing program',
    content: 'Nairobi — President William Ruto launched a new affordable housing program aimed at building 200,000 units by 2030.',
    url: 'https://nation.africa/kenya-housing',
    domain: 'nation.africa',
    language: 'en',
    publishedAt: new Date(NOW.getTime() - 19 * ONE_DAY_MS),
  }),
  makeArticle({
    topic: 'africa',
    title: 'South Africa : Ramaphosa faces new cabinet challenges',
    content: 'Pretoria — President Cyril Ramaphosa faces a cabinet reshuffle amid coalition tensions.',
    url: 'https://dailymaverick.co.za/ramaphosa',
    domain: 'dailymaverick.co.za',
    language: 'en',
    publishedAt: new Date(NOW.getTime() - 17 * ONE_DAY_MS),
  }),
  makeArticle({
    topic: 'tech',
    title: 'Apple announces new Vision Pro 2',
    content: 'Apple unveiled the Vision Pro 2 with a lighter design and longer battery life.',
    url: 'https://theverge.com/vision-pro-2',
    domain: 'theverge.com',
    language: 'en',
    publishedAt: new Date(NOW.getTime() - 14 * ONE_DAY_MS),
  }),
  makeArticle({
    topic: 'finance',
    title: 'Gold prices hit all-time high',
    content: 'Gold prices hit an all-time high amid global uncertainty.',
    url: 'https://ft.com/gold-high',
    domain: 'ft.com',
    language: 'en',
    publishedAt: new Date(NOW.getTime() - 12 * ONE_DAY_MS),
  }),
  makeArticle({
    topic: 'africa',
    title: 'Côte d\'Ivoire : Alassane Ouattara annonce une réforme constitutionnelle',
    content: 'Yamoussoukro — Le président Alassane Ouattara a annoncé une série de réformes constitutionnelles.',
    url: 'https://fraternitematinal.ci/ouattara',
    domain: 'fraternitematinal.ci',
    language: 'fr',
    publishedAt: new Date(NOW.getTime() - 23 * ONE_DAY_MS),
  }),

  // ─────────────────────────────────────────────────────────────────
  // ADVERSARIAL: lexically-similar distractors for cross-cutting
  // queries.  These exist to give cosine a chance to win over BM25
  // — BM25 will match query terms in the distractor titles, but
  // BGE-M3 should see that the semantic intent is different.
  // ─────────────────────────────────────────────────────────────────

  // Distractor for "Mali président inauguration": about an Ivorian
  // president, not Mali.  BM25 will still match "président" +
  // "africa", but should rank lower than the actual Mali article.
  makeArticle({
    id: 'fixture-029',
    topic: 'africa',
    title: 'Côte d\'Ivoire : le chef de l\'État reçoit le président du parlement',
    content: 'Abidjan — Le président ivoirien a reçu son homologue du parlement régional en visite officielle.',
    url: 'https://rti.ci/parlement',
    domain: 'rti.ci',
    language: 'fr',
    publishedAt: new Date(NOW.getTime() - 2 * ONE_DAY_MS),
    qualityScore: 0.6,
  }),

  // Distractor for "African AI startup funding": about Nigerian
  // *fintech* funding, not AI.  BM25 will still match "African"
  // and "funding", but the topic is finance not tech.
  makeArticle({
    id: 'fixture-030',
    topic: 'finance',
    title: 'Nigerian fintech raises $50M Series B',
    content: 'Lagos — A Lagos-based payments company closed a $50M Series B led by an American VC.  Mobile money drives the unit economics.',
    url: 'https://techcabal.com/series-b',
    domain: 'techcabal.com',
    language: 'en',
    publishedAt: new Date(NOW.getTime() - 4 * ONE_DAY_MS),
    qualityScore: 0.7,
  }),

  // Paraphrase of "Bamako Mali nouveau président" — semantically the
  // same as fixture-001 but lexically different.  Cosine should
  // match this even though the query and title share fewer tokens.
  makeArticle({
    id: 'fixture-031',
    topic: 'africa',
    title: 'Mali : le chef de la transition prête serment à Koulouba',
    content: 'Bamako — Le dirigeant de la transition malienne a officiellement prêté serment ce matin au palais de Koulouba.',
    url: 'https://maliweb.net/serment',
    domain: 'maliweb.net',
    language: 'fr',
    publishedAt: new Date(NOW.getTime() - 5 * ONE_DAY_MS),
    qualityScore: 0.9,
  }),
];
