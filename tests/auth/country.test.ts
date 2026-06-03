import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  COUNTRY_COOKIE_NAME,
  DEFAULT_COUNTRY,
  getDefaultCountry,
  setCountryCookie,
  parseCfIpCountry,
} from '@/lib/auth/country';

describe('auth/country', () => {
  const originalCookie = Object.getOwnPropertyDescriptor(document, 'cookie');

  beforeEach(() => {
    Object.defineProperty(document, 'cookie', {
      value: '',
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    if (originalCookie) {
      Object.defineProperty(document, 'cookie', originalCookie);
    }
  });

  it('falls back to SN when no cookie is set', () => {
    expect(getDefaultCountry()).toBe('SN');
    expect(DEFAULT_COUNTRY).toBe('SN');
  });

  it('reads the country from the _country cookie', () => {
    document.cookie = `${COUNTRY_COOKIE_NAME}=CI; Path=/`;
    expect(getDefaultCountry()).toBe('CI');
  });

  it('normalises an unsupported cookie value to the default', () => {
    document.cookie = `${COUNTRY_COOKIE_NAME}=ZZ; Path=/`;
    expect(getDefaultCountry()).toBe('SN');
  });

  it('writes the country cookie with a 1-day TTL', () => {
    const setSpy = vi.spyOn(document, 'cookie', 'set');
    setCountryCookie('ML');
    expect(document.cookie).toContain(`${COUNTRY_COOKIE_NAME}=ML`);
    expect(document.cookie).toContain('Max-Age=86400');
    setSpy.mockRestore();
  });

  it('parses the cf-ipcountry header into a supported country code', () => {
    expect(parseCfIpCountry('sn')).toBe('SN');
    expect(parseCfIpCountry('CI')).toBe('CI');
    expect(parseCfIpCountry(null)).toBe('SN');
    expect(parseCfIpCountry('XX')).toBe('SN');
  });
});
