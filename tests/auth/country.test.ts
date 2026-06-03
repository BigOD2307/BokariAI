import { describe, it, expect } from 'vitest';
import {
  COUNTRY_COOKIE_NAME,
  DEFAULT_COUNTRY,
  parseCfIpCountry,
} from '@/lib/auth/country';

describe('auth/country', () => {
  it('exposes SN as the default country', () => {
    expect(DEFAULT_COUNTRY).toBe('SN');
  });

  it('uses _country as the cookie name', () => {
    expect(COUNTRY_COOKIE_NAME).toBe('_country');
  });

  it('parses the cf-ipcountry header into a supported country code', () => {
    expect(parseCfIpCountry('sn')).toBe('SN');
    expect(parseCfIpCountry('CI')).toBe('CI');
    expect(parseCfIpCountry(null)).toBe('SN');
    expect(parseCfIpCountry('XX')).toBe('SN');
    expect(parseCfIpCountry('ml')).toBe('ML');
  });

  it('handles empty string header as default', () => {
    expect(parseCfIpCountry('')).toBe('SN');
  });

  it('handles undefined header as default', () => {
    expect(parseCfIpCountry(undefined)).toBe('SN');
  });
});
