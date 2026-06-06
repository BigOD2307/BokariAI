/**
 * "L'Afrique en chiffres" — canonical stat definitions.
 *
 * Each figure shown on /data is a keyed entry here. The seed values mirror the
 * figures the page originally hard-coded; the live values live in SQLite
 * (`africa_stats`) so the weekly cron can refresh them. Entries that carry a
 * `query` + bounds are auto-updated: the cron searches the web, extracts the
 * current number, sanity-checks it against [min, max], and overwrites the
 * stored value (with its source link). Entries without a `query` are stable
 * (e.g. "54 pays") and never auto-touched.
 */

export type StatGroup =
  | 'hero'
  | 'population'
  | 'economy'
  | 'digital'
  | 'diversity';

export type StatDef = {
  key: string;
  group: StatGroup;
  label: string;
  seedValue: string;
  seedNumeric?: number;
  unit?: string;
  /** Index into SOURCES (1-based id). */
  sourceId: number;
  /** If set, the weekly cron tries to refresh this figure. */
  query?: string;
  min?: number;
  max?: number;
  /** Render a fresh numeric back into the display string. */
  format?: (n: number) => string;
};

export type StatSource = { id: number; label: string; url: string };

export const SOURCES: StatSource[] = [
  { id: 1, label: 'ONU DESA — World Population Prospects 2024', url: 'https://population.un.org/wpp/' },
  { id: 2, label: 'Banque mondiale — Indicateurs du développement', url: 'https://data.worldbank.org/' },
  { id: 3, label: 'GSMA Intelligence — The Mobile Economy 2024', url: 'https://www.gsma.com/mobileeconomy/' },
  { id: 4, label: 'FMI — World Economic Outlook', url: 'https://www.imf.org/en/Publications/WEO' },
  { id: 5, label: 'Union africaine — États membres', url: 'https://au.int/' },
  { id: 6, label: 'Ethnologue — Languages of the World', url: 'https://www.ethnologue.com/' },
  { id: 7, label: 'UIT — Mesure du numérique', url: 'https://www.itu.int/' },
  { id: 8, label: 'UNESCO UIS — Alphabétisation', url: 'https://uis.unesco.org/' },
];

const pct = (n: number) => `~${Math.round(n)} %`;
const millions = (n: number) => `~${Math.round(n)} M`;
const plain = (n: number) => `${Math.round(n)}`;
const years = (n: number) => `~${Math.round(n)} ans`;
const billionsFromMillions = (n: number) =>
  n >= 1000
    ? `${(n / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Md`
    : `${Math.round(n)} M`;
const signedPct = (n: number) =>
  `${n > 0 ? '+' : ''}${n.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`;

export const STAT_DEFS: StatDef[] = [
  // ── Hero band ──────────────────────────────────────────────
  {
    key: 'hero.population',
    group: 'hero',
    label: 'habitants',
    seedValue: '1,4 Md',
    seedNumeric: 1400, // millions
    sourceId: 1,
    query: "population totale de l'Afrique 2026 en millions d'habitants",
    min: 1300,
    max: 1700,
    format: billionsFromMillions,
  },
  { key: 'hero.countries', group: 'hero', label: 'pays', seedValue: '54', seedNumeric: 54, sourceId: 5 },
  {
    key: 'hero.medianAge',
    group: 'hero',
    label: 'âge médian',
    seedValue: '~19 ans',
    seedNumeric: 19,
    sourceId: 1,
    query: "âge médian de la population en Afrique 2026",
    min: 15,
    max: 26,
    format: years,
  },
  { key: 'hero.languages', group: 'hero', label: 'langues', seedValue: '~2 100', seedNumeric: 2100, sourceId: 6 },

  // ── Population & démographie ───────────────────────────────
  {
    key: 'pop.urbanization',
    group: 'population',
    label: 'Urbanisation',
    seedValue: '~43 %',
    seedNumeric: 43,
    sourceId: 2,
    query: "taux d'urbanisation en Afrique 2026 pourcentage",
    min: 30,
    max: 60,
    format: pct,
  },
  {
    key: 'pop.youth',
    group: 'population',
    label: 'Jeunes (15-24 ans)',
    seedValue: '~19 %',
    seedNumeric: 19,
    sourceId: 2,
    query: "part des 15-24 ans dans la population africaine pourcentage",
    min: 12,
    max: 28,
    format: pct,
  },
  // Top-5 population (millions)
  { key: 'pop.rank.nigeria', group: 'population', label: 'Nigeria', seedValue: '223', seedNumeric: 223, unit: 'M', sourceId: 1, query: 'population du Nigeria 2026 en millions', min: 180, max: 320, format: plain },
  { key: 'pop.rank.ethiopia', group: 'population', label: 'Éthiopie', seedValue: '123', seedNumeric: 123, unit: 'M', sourceId: 1, query: "population de l'Éthiopie 2026 en millions", min: 100, max: 180, format: plain },
  { key: 'pop.rank.egypt', group: 'population', label: 'Égypte', seedValue: '107', seedNumeric: 107, unit: 'M', sourceId: 1, query: "population de l'Égypte 2026 en millions", min: 90, max: 150, format: plain },
  { key: 'pop.rank.drc', group: 'population', label: 'RD Congo', seedValue: '99', seedNumeric: 99, unit: 'M', sourceId: 1, query: 'population de la RD Congo 2026 en millions', min: 80, max: 160, format: plain },
  { key: 'pop.rank.tanzania', group: 'population', label: 'Tanzanie', seedValue: '65', seedNumeric: 65, unit: 'M', sourceId: 1, query: 'population de la Tanzanie 2026 en millions', min: 55, max: 110, format: plain },

  // ── Économie ───────────────────────────────────────────────
  // Top-5 GDP nominal (Md $)
  { key: 'eco.rank.nigeria', group: 'economy', label: 'Nigeria', seedValue: '477', seedNumeric: 477, unit: 'Md $', sourceId: 4, query: 'PIB nominal du Nigeria 2026 en milliards de dollars', min: 200, max: 700, format: plain },
  { key: 'eco.rank.egypt', group: 'economy', label: 'Égypte', seedValue: '406', seedNumeric: 406, unit: 'Md $', sourceId: 4, query: "PIB nominal de l'Égypte 2026 en milliards de dollars", min: 200, max: 700, format: plain },
  { key: 'eco.rank.southafrica', group: 'economy', label: 'Afrique du Sud', seedValue: '405', seedNumeric: 405, unit: 'Md $', sourceId: 4, query: "PIB nominal de l'Afrique du Sud 2026 en milliards de dollars", min: 250, max: 600, format: plain },
  { key: 'eco.rank.algeria', group: 'economy', label: 'Algérie', seedValue: '267', seedNumeric: 267, unit: 'Md $', sourceId: 4, query: "PIB nominal de l'Algérie 2026 en milliards de dollars", min: 150, max: 450, format: plain },
  { key: 'eco.rank.morocco', group: 'economy', label: 'Maroc', seedValue: '162', seedNumeric: 162, unit: 'Md $', sourceId: 4, query: 'PIB nominal du Maroc 2026 en milliards de dollars', min: 100, max: 350, format: plain },
  {
    key: 'eco.senegalGrowth',
    group: 'economy',
    label: 'Sénégal',
    seedValue: '+4,8 %',
    seedNumeric: 4.8,
    sourceId: 4,
    query: 'taux de croissance du PIB du Sénégal 2026 pourcentage',
    min: -5,
    max: 15,
    format: signedPct,
  },
  {
    key: 'eco.literacy',
    group: 'economy',
    label: 'Alphabétisation',
    seedValue: '~67 %',
    seedNumeric: 67,
    sourceId: 8,
    query: "taux d'alphabétisation des adultes en Afrique pourcentage",
    min: 45,
    max: 85,
    format: pct,
  },
  {
    key: 'eco.renewable',
    group: 'economy',
    label: 'Électricité renouvelable',
    seedValue: '~48 %',
    seedNumeric: 48,
    sourceId: 2,
    query: "part de l'électricité d'origine renouvelable en Afrique pourcentage",
    min: 20,
    max: 75,
    format: pct,
  },

  // ── Numérique & mobile ─────────────────────────────────────
  {
    key: 'dig.mobileSubs',
    group: 'digital',
    label: 'Abonnements mobiles',
    seedValue: '~575 M',
    seedNumeric: 575,
    sourceId: 3,
    query: "nombre d'abonnés mobiles uniques en Afrique subsaharienne millions",
    min: 400,
    max: 850,
    format: millions,
  },
  {
    key: 'dig.internet',
    group: 'digital',
    label: 'Internautes',
    seedValue: '~320 M',
    seedNumeric: 320,
    sourceId: 7,
    query: "nombre d'internautes en Afrique en millions",
    min: 200,
    max: 700,
    format: millions,
  },
  {
    key: 'dig.mobileMoney',
    group: 'digital',
    label: 'Comptes mobile money',
    seedValue: '~250 M',
    seedNumeric: 250,
    sourceId: 3,
    query: 'nombre de comptes mobile money actifs en Afrique millions',
    min: 150,
    max: 600,
    format: millions,
  },

  // ── Diversité (stables) ────────────────────────────────────
  { key: 'div.languages', group: 'diversity', label: 'Langues parlées', seedValue: '~2 100', seedNumeric: 2100, sourceId: 6 },
  { key: 'div.countries', group: 'diversity', label: 'Pays', seedValue: '54', seedNumeric: 54, sourceId: 5 },
  { key: 'div.dataCost', group: 'diversity', label: 'Coût des données', seedValue: '~1,5–3 %', sourceId: 3 },
];

export function getStatDef(key: string): StatDef | undefined {
  return STAT_DEFS.find((d) => d.key === key);
}

export function getAutoStatDefs(): StatDef[] {
  return STAT_DEFS.filter((d) => d.query && d.format && d.min !== undefined && d.max !== undefined);
}

export function sourceById(id: number): StatSource | undefined {
  return SOURCES.find((s) => s.id === id);
}
