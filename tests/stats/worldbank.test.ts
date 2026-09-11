import { describe, it, expect, vi } from 'vitest';
import {
  fetchIndicator,
  latestValue,
  sumLatest,
  indicatorUrl,
} from '@/lib/stats/worldbank';

const wbPage = (rows: Array<Record<string, unknown>>) => [
  { page: 1, pages: 1, per_page: 100, total: rows.length },
  rows,
];

const row = (code: string, date: string, value: number | null) => ({
  indicator: { id: 'SP.POP.TOTL', value: 'Population, total' },
  country: { id: code.slice(0, 2), value: code },
  countryiso3code: code,
  date,
  value,
  unit: '',
  obs_status: '',
  decimal: 0,
});

const fetchOk = (rows: Array<Record<string, unknown>>) =>
  vi.fn(
    async () => new Response(JSON.stringify(wbPage(rows)), { status: 200 }),
  );

describe('fetchIndicator', () => {
  it('keeps the latest non-null value per country', async () => {
    const map = await fetchIndicator(
      ['NGA'],
      'SP.POP.TOTL',
      fetchOk([
        row('NGA', '2025', 237527782),
        row('NGA', '2024', 232679478),
        row('NGA', '2023', null),
      ]),
    );
    expect(map.get('NGA')).toEqual({
      country: 'NGA',
      year: 2025,
      value: 237527782,
    });
  });

  it('skips null and malformed rows', async () => {
    const map = await fetchIndicator(
      ['NGA'],
      'SP.POP.TOTL',
      fetchOk([
        row('NGA', '2025', null),
        { countryiso3code: 'NGA', date: 'nope', value: 5 },
      ]),
    );
    expect(map.get('NGA')).toBeUndefined();
  });

  it('returns an empty map on network or HTTP failure (never throws)', async () => {
    const fail = vi.fn(async () => {
      throw new Error('ECONNRESET');
    });
    expect(await fetchIndicator(['NGA'], 'SP.POP.TOTL', fail)).toEqual(
      new Map(),
    );
    const bad = vi.fn(async () => new Response('nope', { status: 500 }));
    expect(await fetchIndicator(['NGA'], 'SP.POP.TOTL', bad)).toEqual(
      new Map(),
    );
  });

  it('handles all countries in one call', async () => {
    const map = await fetchIndicator(
      ['NGA', 'ETH'],
      'SP.POP.TOTL',
      fetchOk([row('NGA', '2025', 237527782), row('ETH', '2025', 135472051)]),
    );
    expect(map.size).toBe(2);
  });
});

describe('latestValue', () => {
  it('returns the single-country point or null', async () => {
    const p = await latestValue(
      'NGA',
      'SP.POP.TOTL',
      fetchOk([row('NGA', '2025', 237527782)]),
    );
    expect(p?.value).toBe(237527782);
    expect(await latestValue('NGA', 'SP.POP.TOTL', fetchOk([]))).toBeNull();
  });
});

describe('sumLatest', () => {
  it('sums contributors and takes the stalest year', async () => {
    const p = await sumLatest(
      ['SSF', 'EGY'],
      'SP.POP.TOTL',
      fetchOk([row('SSF', '2025', 1321654217), row('EGY', '2024', 114535772)]),
    );
    expect(p).toEqual({
      country: 'SSF+EGY',
      year: 2024, // stalest leg wins — no fake freshness
      value: 1321654217 + 114535772,
    });
  });

  it('returns null when any contributor is missing (incomplete sum is worse than none)', async () => {
    const p = await sumLatest(
      ['SSF', 'EGY'],
      'SP.POP.TOTL',
      fetchOk([row('SSF', '2025', 1)]),
    );
    expect(p).toBeNull();
  });
});

describe('indicatorUrl', () => {
  it('links the human indicator page, not the API', () => {
    expect(indicatorUrl('SP.POP.TOTL')).toBe(
      'https://data.worldbank.org/indicator/SP.POP.TOTL',
    );
  });
});
