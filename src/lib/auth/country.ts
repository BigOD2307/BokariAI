export const COUNTRY_COOKIE_NAME = '_country';
export const DEFAULT_COUNTRY = 'SN';
export const COUNTRY_COOKIE_MAX_AGE = 60 * 60 * 24;

export const SUPPORTED_COUNTRIES = [
  'SN',
  'CI',
  'ML',
  'BF',
  'NE',
  'TG',
  'BJ',
  'CM',
  'GA',
  'CG',
  'CD',
  'FR',
  'NG',
  'GH',
  'KE',
] as const;

export type CountryCode = (typeof SUPPORTED_COUNTRIES)[number];

const isSupportedCountry = (value: string): value is CountryCode => {
  return (SUPPORTED_COUNTRIES as readonly string[]).includes(value);
};

const readCookieFromDocument = (name: string): string | null => {
  if (typeof document === 'undefined') return null;
  const target = `${name}=`;
  const segments = document.cookie ? document.cookie.split(';') : [];
  for (const segment of segments) {
    const trimmed = segment.trim();
    if (trimmed.startsWith(target)) {
      return decodeURIComponent(trimmed.slice(target.length));
    }
  }
  return null;
};

const normalizeCountry = (value: string | null | undefined): CountryCode => {
  if (!value) return DEFAULT_COUNTRY;
  const upper = value.toUpperCase();
  if (isSupportedCountry(upper)) return upper;
  return DEFAULT_COUNTRY;
};

export const getDefaultCountry = (): CountryCode => {
  if (typeof document === 'undefined') return DEFAULT_COUNTRY;
  return normalizeCountry(readCookieFromDocument(COUNTRY_COOKIE_NAME));
};

export const setCountryCookie = (country: CountryCode): void => {
  if (typeof document === 'undefined') return;
  const safe = normalizeCountry(country);
  document.cookie = `${COUNTRY_COOKIE_NAME}=${safe}; Path=/; Max-Age=${COUNTRY_COOKIE_MAX_AGE}; SameSite=Lax`;
};

export const parseCfIpCountry = (headerValue: string | null): CountryCode => {
  if (!headerValue) return DEFAULT_COUNTRY;
  return normalizeCountry(headerValue);
};
