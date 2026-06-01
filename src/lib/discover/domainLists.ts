/**
 * @module discover/domainLists
 * @description Curated domain lists used by the Discover pipeline.
 * @author Amadou — Dicken AI
 * @version 1.0.0
 *
 * The African-source boost is a hard-coded list (for now). Sources are
 * picked from RFI, France24, Jeune Afrique, and country-level outlets
 * across UEMOA / CEMAC / East Africa.
 *
 * The blocked-domains list is for spam farms we never want to surface
 * (link farms, SEO scrapers, low-quality aggregators).
 *
 * Both lists are intentionally conservative. Adding a domain here is a
 * product decision: "we trust this source" / "we never want this source".
 */

/**
 * African / African-relevant news domains.
 * Used for the African-source boost when the query has African context.
 * Compared with hostname stripped of leading "www.".
 */
export const AFRICAN_DOMAINS: ReadonlySet<string> = new Set([
  // Pan-African / francophone international
  'rfi.fr',
  'france24.com',
  'france24.fr',
  'jeuneafrique.com',
  'theafricareport.com',
  'africanews.com',
  'allafrica.com',
  'africanarguments.org',
  'afrique-sur7.fr',
  'afrique.latribune.fr',
  // Mali
  'maliactu.net',
  'maliweb.net',
  'bamada.net',
  'journaldumali.com',
  'abamako.com',
  'malijet.com',
  'essorama.com',
  'mali7.net',
  // Senegal
  'seneweb.com',
  'dakaractu.com',
  'lequotidien.sn',
  'pressafrik.com',
  'leral.net',
  'walf.sn',
  'sudonline.sn',
  // Côte d'Ivoire
  'koaci.com',
  'fratmat.info',
  'abidjan.net',
  'connectionivoirienne.net',
  'lintelligentdabidjan.info',
  'ivoiresoir.net',
  // Guinea
  'guineenews.org',
  'guinee360.com',
  'mosaiqueguinee.com',
  'guineematin.com',
  // Burkina Faso
  'burkina24.com',
  'lefaso.net',
  'lobs.bf',
  'sidwaya.bf',
  // Niger
  'nigerdiaspora.net',
  'actuniger.com',
  'lejournee.com',
  // Cameroon
  'lnc-news.com',
  'journalducameroun.com',
  'camernews.com',
  'cameroon-tribune.cm',
  // Congo / RDC
  'congopage.com',
  'actualite.cd',
  'radiookapi.net',
  'lepotentiel.com',
  'mediacongo.net',
  // Nigeria
  'punchng.com',
  'premiumtimesng.com',
  'thenationonlineng.net',
  'guardian.ng',
  'vanguardngr.com',
  'thisdaylive.com',
  'thecable.ng',
  // Kenya
  'nation.africa',
  'standardmedia.co.ke',
  'the-star.co.ke',
  'tuko.co.ke',
  // Uganda
  'monitor.co.ug',
  'newvision.co.ug',
  // Tanzania
  'thecitizen.co.tz',
  'dailynews.co.tz',
  // Ghana
  'myjoyonline.com',
  'citinewsroom.com',
  'graphic.com.gh',
  // International wire services (highly relevant for Africa)
  'reuters.com',
  'bbc.com',
  'bbc.co.uk',
  'lemonde.fr',
  'apnews.com',
  'theguardian.com',
  'alaraby.co.uk',
]);

/**
 * Domains we never want in the Discover feed.
 * Either spam farms, low-quality aggregators, or content farms.
 */
export const BLOCKED_DOMAINS: ReadonlySet<string> = new Set([
  // SEO link farms (add real examples as they're identified)
  'semrush.com',
  'ahrefs.com',
  'spam.com',
  // Social media (we surface news, not profiles)
  'facebook.com',
  'twitter.com',
  'x.com',
  'tiktok.com',
  'instagram.com',
  'linkedin.com',
  // Generative AI content farms (we don't want to feed the loop)
  'medium.com',       // too noisy, prefer canonical sources
  'reddit.com',       // discussion, not journalism
  'quora.com',
  'pinterest.com',
  // PDF / doc hosts (we want HTML articles)
  'scribd.com',
  // Wikipedia (we can integrate separately; not a news source)
  'wikipedia.org',
]);

/**
 * Check if a domain is African (after stripping "www.").
 */
export function isAfricanDomain(domain: string): boolean {
  if (!domain) return false;
  return AFRICAN_DOMAINS.has(domain.toLowerCase().replace(/^www\./, ''));
}

/**
 * Check if a domain is blocked.
 */
export function isBlockedDomain(domain: string): boolean {
  if (!domain) return false;
  return BLOCKED_DOMAINS.has(domain.toLowerCase().replace(/^www\./, ''));
}
