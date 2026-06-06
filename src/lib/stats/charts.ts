/**
 * Static, sourced datasets for the /data page charts.
 *
 * These are reference figures + multi-year series (rankings, trends, sector
 * shares) gathered from authoritative sources (UN DESA WPP 2024, IMF WEO, AfDB
 * AEO 2026, GSMA, World Bank). Unlike the scalars in `africa_stats` (which the
 * weekly cron auto-updates), these are stable historical/projection series that
 * don't change week to week — kept as vetted constants so the charts are real
 * and never fabricated. Each carries a sourceId into CHART_SOURCES.
 *
 * NB: "digital" / "mobile money" figures are Sub-Saharan Africa (GSMA scope);
 * population, GDP and demographics cover the whole continent. See research
 * workflow wf_5594be93-166.
 */

export type ChartSource = { id: number; label: string; url: string };

export const CHART_SOURCES: ChartSource[] = [
  { id: 1, label: 'ONU DESA — World Population Prospects 2024', url: 'https://population.un.org/wpp/' },
  { id: 3, label: 'FMI — World Economic Outlook', url: 'https://www.imf.org/en/Publications/WEO' },
  { id: 4, label: 'Banque africaine de développement — Perspectives économiques 2026', url: 'https://www.afdb.org/en/knowledge/publications/african-economic-outlook' },
  { id: 5, label: 'GSMA — The Mobile Economy Sub-Saharan Africa 2024', url: 'https://www.gsmaintelligence.com/research/the-mobile-economy-sub-saharan-africa-2024' },
  { id: 6, label: 'GSMA — State of the Industry Report on Mobile Money 2025', url: 'https://www.gsma.com/sotir/' },
  { id: 7, label: 'Banque mondiale / Statista — PIB par secteur, Afrique subsaharienne 2023', url: 'https://data.worldbank.org/' },
];

/** Top African countries by population (millions, UN WPP 2024 estimates). */
export const POPULATION_TOP = [
  { country: 'Nigéria', millions: 227.9 },
  { country: 'Éthiopie', millions: 128.7 },
  { country: 'Égypte', millions: 114.5 },
  { country: 'RD Congo', millions: 105.8 },
  { country: 'Tanzanie', millions: 66.6 },
  { country: 'Afrique du Sud', millions: 63.2 },
  { country: 'Kenya', millions: 55.3 },
  { country: 'Soudan', millions: 50.0 },
  { country: 'Ouganda', millions: 48.7 },
  { country: 'Algérie', millions: 46.2 },
];

/** Africa total population by year, millions (UN WPP 2024; 2030+ = median projection). */
export const POPULATION_TREND = [
  { year: 2000, millions: 811 },
  { year: 2010, millions: 1055 },
  { year: 2020, millions: 1361 },
  { year: 2024, millions: 1520 },
  { year: 2030, millions: 1711 },
  { year: 2040, millions: 2103 },
  { year: 2050, millions: 2485 },
];

/** Top African economies by nominal GDP (billions USD, IMF WEO 2024). */
export const ECONOMY_TOP = [
  { country: 'Afrique du Sud', billions: 373 },
  { country: 'Égypte', billions: 347 },
  { country: 'Algérie', billions: 266 },
  { country: 'Nigéria', billions: 253 },
  { country: 'Éthiopie', billions: 205 },
  { country: 'Maroc', billions: 157 },
  { country: 'Kenya', billions: 116 },
  { country: 'Angola', billions: 113 },
  { country: "Côte d'Ivoire", billions: 87 },
  { country: 'Ghana', billions: 76 },
];

/** Africa real GDP growth % by year (AfDB AEO 2026; 2026-2027 = projection). */
export const GROWTH_TREND = [
  { year: 2022, growth: 4.1 },
  { year: 2023, growth: 3.0 },
  { year: 2024, growth: 3.2 },
  { year: 2025, growth: 4.2 },
  { year: 2026, growth: 4.3 },
  { year: 2027, growth: 4.5 },
];

/** GDP by broad sector, Sub-Saharan Africa 2023 (% — World Bank). */
export const SECTOR_SHARES = [
  { sector: 'Services', pct: 45 },
  { sector: 'Industrie', pct: 27 },
  { sector: 'Agriculture', pct: 17 },
  { sector: 'Taxes nettes / autres', pct: 11 },
];

/** Mobile/internet adoption (Sub-Saharan Africa, millions, GSMA 2024). */
export const DIGITAL_COMPARE = [
  { name: 'Comptes mobile money', millions: 1000 },
  { name: 'Abonnés mobiles uniques', millions: 710 },
  { name: 'Internautes mobiles', millions: 416 },
];

/** African internet users by year, millions (GSMA; 2030 = projection). */
export const DIGITAL_TREND = [
  { year: 2020, millions: 280 },
  { year: 2022, millions: 360 },
  { year: 2024, millions: 416 },
  { year: 2030, millions: 576 },
];
