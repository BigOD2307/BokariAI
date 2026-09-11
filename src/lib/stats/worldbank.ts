/**
 * C11 — World Bank API client (primary data, zero LLM).
 *
 * The open data API needs no key: https://api.worldbank.org/v2/... It is the
 * authoritative source for the population / GDP / urbanisation / literacy /
 * internet figures on /data — asking a press-snippet-reading LLM for a number
 * the primary source serves in one HTTP call was indefensible for a product
 * that sells verification.
 *
 * Every function here is total: network error, bad shape, or no usable value
 * resolves to null, and the caller (update.ts) falls back to the legacy
 * LLM+search refresh. A dead World Bank API degrades to the old behaviour,
 * never to a crash or a fabricated number.
 */

export type WBPoint = { country: string; year: number; value: number };

type WBRow = {
  country?: { id?: string; value?: string };
  countryiso3code?: string;
  date?: string;
  value?: number | string | null;
};

const BASE = 'https://api.worldbank.org/v2';
const TIMEOUT_MS = 15_000;
/** Last decade is plenty — we only ever read the latest non-null value. */
const RANGE = '2015:2026';

/** ISO-3166 alpha-3 codes of North-African countries (WB MEA region). */
export const NORTH_AFRICA = ['DZA', 'EGY', 'LBY', 'MAR', 'TUN', 'SDN'] as const;

/**
 * Fetch one indicator for several countries in ONE call
 * (country/A;B;C/indicator/X). Returns the latest non-null point per country.
 */
export async function fetchIndicator(
  countries: string[],
  indicator: string,
  fetchFn: typeof fetch = fetch,
): Promise<Map<string, WBPoint>> {
  const out = new Map<string, WBPoint>();
  if (countries.length === 0) return out;

  let json: unknown;
  try {
    const res = await fetchFn(
      `${BASE}/country/${countries.join(';')}/indicator/${indicator}?format=json&per_page=100&date=${RANGE}`,
      {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { Accept: 'application/json' },
      },
    );
    if (!res.ok) return out;
    json = await res.json();
  } catch {
    return out;
  }

  const pages = Array.isArray(json) ? json : [];
  const rows: WBRow[] = Array.isArray(pages[1]) ? pages[1] : [];
  for (const r of rows) {
    const code = (r.countryiso3code ?? r.country?.id ?? '').toUpperCase();
    const year = Number(r.date);
    const value = typeof r.value === 'string' ? Number(r.value) : r.value;
    if (
      !code ||
      !Number.isInteger(year) ||
      typeof value !== 'number' ||
      !Number.isFinite(value)
    ) {
      continue;
    }
    const prev = out.get(code);
    // Rows come newest-first, but don't rely on it: keep the latest year.
    if (!prev || year > prev.year)
      out.set(code, { country: code, year, value });
  }
  return out;
}

/**
 * Latest value of one indicator for one country/aggregate. Null when the
 * API has nothing usable (caller falls back to legacy refresh).
 */
export async function latestValue(
  country: string,
  indicator: string,
  fetchFn: typeof fetch = fetch,
): Promise<WBPoint | null> {
  const map = await fetchIndicator([country], indicator, fetchFn);
  return map.get(country.toUpperCase()) ?? null;
}

/**
 * Sum of the latest values across countries, with the reference year being
 * the OLDEST of the contributors (a sum is only as fresh as its stalest
 * part — claiming 2025 for a sum that includes a 2023 figure would be a lie).
 * Used for hero.population: SSF aggregate + North-African countries.
 */
export async function sumLatest(
  countries: string[],
  indicator: string,
  fetchFn: typeof fetch = fetch,
): Promise<WBPoint | null> {
  const map = await fetchIndicator(countries, indicator, fetchFn);
  let total = 0;
  let year = Infinity;
  let count = 0;
  for (const code of countries) {
    const p = map.get(code.toUpperCase());
    if (!p) return null; // incomplete sum is worse than no sum
    total += p.value;
    year = Math.min(year, p.year);
    count += 1;
  }
  if (count === 0) return null;
  return { country: countries.join('+'), year, value: total };
}

/** Canonical source link for a figure: the indicator page, not a deep API URL. */
export function indicatorUrl(indicator: string): string {
  return `https://data.worldbank.org/indicator/${indicator}`;
}
