import { describe, expect, it } from 'vitest';
import { assertAllowedProviderBaseURL, assertPublicHttpUrl } from '@/lib/net/url-guard';

// Every case below uses a literal IP as the hostname. Node's dns.lookup
// resolves a literal IP locally (getaddrinfo short-circuits — no network
// query), so these stay network-free per repo convention (AGENTS.md,
// tests/setup.ts) while still exercising the real isPublicAddress logic.
describe('assertPublicHttpUrl', () => {
  it.each([
    'http://127.0.0.1:3000/api/config',
    'http://169.254.169.254/latest/meta-data/',
    'http://[::1]:8080/',
    'file:///etc/passwd',
    'http://10.0.0.5/',
    'http://192.168.1.1/',
    'http://172.16.0.1/',
    'http://100.64.0.1/', // CGNAT
  ])('refuses %s', async (url) => {
    await expect(assertPublicHttpUrl(url)).rejects.toThrow();
  });

  it('accepts a URL whose host resolves to a public address', async () => {
    await expect(assertPublicHttpUrl('http://93.184.216.34/page')).resolves.toBeInstanceOf(URL);
  });

  it('rejects a non-http(s) protocol', async () => {
    await expect(assertPublicHttpUrl('ftp://93.184.216.34/file')).rejects.toThrow();
  });
});

describe('assertAllowedProviderBaseURL', () => {
  it('accepts the canonical OpenAI host over https', () => {
    expect(() =>
      assertAllowedProviderBaseURL('openai', 'https://api.openai.com/v1'),
    ).not.toThrow();
  });

  it('refuses a baseURL redirected to a different host', () => {
    expect(() =>
      assertAllowedProviderBaseURL('openai', 'https://evil.example.com/v1'),
    ).toThrow();
  });

  it('refuses a non-https baseURL for a hosted provider', () => {
    expect(() =>
      assertAllowedProviderBaseURL('openai', 'http://api.openai.com/v1'),
    ).toThrow();
  });

  it('refuses an unknown provider type entirely', () => {
    expect(() =>
      assertAllowedProviderBaseURL('unknown-provider', 'https://api.openai.com/v1'),
    ).toThrow();
  });
});
