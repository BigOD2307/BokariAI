/**
 * Editorial register of the outlets ingested by the news crawler (C9).
 *
 * Every entry's feed was verified reachable on 2026-08-30 (audit, annexe C).
 * The registry is versioned like code: a source is added here, the crawler
 * seeds it into `news_sources` on its next pass — no manual DB edits.
 *
 * Tier 1 = news agency, or IFCN/JTI-certified outlet.
 * Tier 2 = established private press.
 * Tier 3 = aggregator that republishes other outlets verbatim (dedup by
 *          content_hash matters most for these).
 *
 * Explicitly excluded, with the reason, so nobody re-adds them by mistake —
 * see EXCLUDED_DOMAINS.
 */

export type SourceSeed = {
  domain: string;
  name: string;
  /** ISO 3166-1 alpha-2 country code of the outlet's editorial home. */
  country: string;
  feedUrl: string | null;
  tier: 1 | 2 | 3;
  isStateMedia?: boolean;
  /** IFCN or JTI certification. */
  isCertified?: boolean;
  /** ISO codes of countries where the outlet is blocked or suspended. */
  suspendedIn?: string[];
};

export const SOURCE_SEEDS: SourceSeed[] = [
  // — Mali
  {
    domain: 'studiotamani.org',
    name: 'Studio Tamani',
    country: 'ML',
    feedUrl: 'https://www.studiotamani.org/feed',
    tier: 1,
    isCertified: true,
  },
  {
    domain: 'journaldumali.com',
    name: 'Journal du Mali',
    country: 'ML',
    feedUrl: 'https://www.journaldumali.com/feed/',
    tier: 2,
  },
  {
    domain: 'saheltribune.com',
    name: 'Sahel Tribune',
    country: 'ML',
    feedUrl: 'https://saheltribune.com/feed/',
    tier: 2,
  },
  {
    domain: 'maliweb.net',
    name: 'Maliweb',
    country: 'ML',
    feedUrl: 'https://www.maliweb.net/rss/latest-posts',
    tier: 3,
  },
  {
    domain: 'malijet.com',
    name: 'Malijet',
    country: 'ML',
    feedUrl: 'https://malijet.com/rss',
    tier: 3,
  },
  {
    domain: 'benbere.org',
    name: 'Benbere',
    country: 'ML',
    feedUrl: 'https://benbere.org/feed/',
    tier: 1,
    isCertified: true,
  },
  {
    domain: 'lejalon.com',
    name: 'Le Jalon / MaliCheck',
    country: 'ML',
    feedUrl: 'https://lejalon.com/feed/',
    tier: 1,
    isCertified: true,
  },
  // — Sénégal
  {
    domain: 'aps.sn',
    name: 'APS',
    country: 'SN',
    feedUrl: 'https://aps.sn/feed/',
    tier: 1,
    isStateMedia: true,
  },
  {
    domain: 'pressafrik.com',
    name: 'PressAfrik',
    country: 'SN',
    feedUrl: 'https://www.pressafrik.com/xml/syndication.rss',
    tier: 1,
    isCertified: true,
  },
  {
    domain: 'lequotidien.sn',
    name: 'Le Quotidien',
    country: 'SN',
    feedUrl: 'https://lequotidien.sn/feed/',
    tier: 2,
  },
  {
    domain: 'seneweb.com',
    name: 'Seneweb',
    country: 'SN',
    feedUrl: 'https://www.seneweb.com/feed',
    tier: 2,
  },
  {
    domain: 'lesoleil.sn',
    name: 'Le Soleil',
    country: 'SN',
    feedUrl: 'https://lesoleil.sn/feed/',
    tier: 2,
    isStateMedia: true,
  },
  {
    domain: 'dakaractu.com',
    name: 'Dakaractu',
    country: 'SN',
    feedUrl: 'https://www.dakaractu.com/xml/syndication.rss',
    tier: 2,
  },
  // — Côte d'Ivoire
  {
    domain: 'aip.ci',
    name: 'AIP',
    country: 'CI',
    feedUrl: 'https://www.aip.ci/feed/',
    tier: 1,
    isStateMedia: true,
  },
  {
    domain: 'linfodrome.com',
    name: "L'Infodrome",
    country: 'CI',
    feedUrl: 'https://www.linfodrome.com/rss',
    tier: 2,
  },
  {
    domain: 'fratmat.info',
    name: 'Fraternité Matin',
    country: 'CI',
    feedUrl: 'https://www.fratmat.info/rssFeed/0',
    tier: 2,
    isStateMedia: true,
  },
  {
    domain: 'abidjan.net',
    name: 'Abidjan.net',
    country: 'CI',
    feedUrl: 'https://news.abidjan.net/rss/actualites.xml',
    tier: 3,
  },
  // — Burkina Faso
  {
    domain: 'lefaso.net',
    name: 'Lefaso.net',
    country: 'BF',
    feedUrl: 'https://lefaso.net/spip.php?page=backend',
    tier: 1,
  },
  {
    domain: 'aib.media',
    name: 'AIB',
    country: 'BF',
    feedUrl: 'https://www.aib.media/feed/',
    tier: 1,
    isStateMedia: true,
  },
  {
    domain: 'burkina24.com',
    name: 'Burkina24',
    country: 'BF',
    feedUrl: 'https://www.burkina24.com/feed/',
    tier: 2,
  },
  {
    domain: 'fasocheck.org',
    name: 'FasoCheck',
    country: 'BF',
    feedUrl: 'https://fasocheck.org/feed/',
    tier: 1,
    isCertified: true,
  },
  // — Niger
  {
    domain: 'anp.ne',
    name: 'ANP',
    country: 'NE',
    feedUrl: 'https://anp.ne/feed/',
    tier: 1,
    isStateMedia: true,
  },
  {
    domain: 'tamtaminfo.com',
    name: 'Tamtaminfo',
    country: 'NE',
    feedUrl: 'https://tamtaminfo.com/feed/',
    tier: 2,
  },
  // — Togo
  {
    domain: 'togo-first.com',
    name: 'Togo First',
    country: 'TG',
    feedUrl: 'https://www.togo-first.com/rss.xml',
    tier: 2,
  },
  {
    domain: 'icilome.com',
    name: 'Icilome',
    country: 'TG',
    feedUrl: 'https://www.icilome.com/rss/news.xml',
    tier: 2,
  },
  // — Bénin
  {
    domain: 'beninwebtv.com',
    name: 'Bénin Web TV',
    country: 'BJ',
    feedUrl: 'https://beninwebtv.com/feed/',
    tier: 2,
  },
  {
    domain: 'lanouvelletribune.info',
    name: 'La Nouvelle Tribune',
    country: 'BJ',
    feedUrl: 'https://lanouvelletribune.info/feed/',
    tier: 2,
  },
  // — Cameroun
  {
    domain: 'actucameroun.com',
    name: 'Actu Cameroun',
    country: 'CM',
    feedUrl: 'https://actucameroun.com/feed/',
    tier: 2,
  },
  {
    domain: 'journalducameroun.com',
    name: 'Journal du Cameroun',
    country: 'CM',
    feedUrl: 'https://www.journalducameroun.com/feed/',
    tier: 2,
  },
  {
    domain: 'mimimefoinfos.com',
    name: 'Mimi Mefo Info',
    country: 'CM',
    feedUrl: 'https://www.mimimefoinfos.com/feed',
    tier: 2,
  },
  // — RDC
  {
    domain: 'actualite.cd',
    name: 'Actualite.cd',
    country: 'CD',
    feedUrl: 'https://actualite.cd/rss.xml',
    tier: 1,
  },
  {
    domain: 'beto.cd',
    name: 'Beto.cd',
    country: 'CD',
    feedUrl: 'https://beto.cd/rss',
    tier: 2,
  },
  // — Guinée
  {
    domain: 'guineenews.org',
    name: 'Guineenews',
    country: 'GN',
    feedUrl: 'https://guineenews.org/feed/',
    tier: 2,
  },
  {
    domain: 'guinee360.com',
    name: 'Guinee360',
    country: 'GN',
    feedUrl: 'https://www.guinee360.com/feed/',
    tier: 2,
  },
  // — Panafricains / agences internationales
  {
    domain: 'rfi.fr',
    name: 'RFI Afrique',
    country: 'FR',
    feedUrl: 'https://www.rfi.fr/fr/afrique/rss',
    tier: 1,
    isCertified: true,
    suspendedIn: ['ML', 'BF', 'NE'],
  },
  // BBC Afrique's feed lives on feeds.bbci.co.uk, not bbc.com — canonicalUrl
  // dedup keys on the ARTICLE's domain, which is bbc.com.
  {
    domain: 'bbc.com',
    name: 'BBC Afrique',
    country: 'GB',
    feedUrl: 'https://feeds.bbci.co.uk/afrique/rss.xml',
    tier: 1,
    suspendedIn: ['NE'],
  },
  {
    domain: 'lemonde.fr',
    name: 'Le Monde Afrique',
    country: 'FR',
    feedUrl: 'https://www.lemonde.fr/afrique/rss_full.xml',
    tier: 1,
  },
  {
    domain: 'financialafrik.com',
    name: 'Financial Afrik',
    country: 'SN',
    feedUrl: 'https://www.financialafrik.com/feed/',
    tier: 1,
    isCertified: true,
  },
  {
    domain: 'fr.africanews.com',
    name: 'Africanews',
    country: 'FR',
    feedUrl: 'https://fr.africanews.com/feed/',
    tier: 2,
  },
];

/** Explicitly excluded, with the reason, so nobody re-adds them by mistake. */
export const EXCLUDED_DOMAINS: Record<string, string> = {
  'voaafrique.com':
    "Rédaction à l'arrêt depuis mars 2025 ; le site sert encore des dépêches périmées.",
};
