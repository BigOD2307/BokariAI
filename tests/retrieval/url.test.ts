import { describe, expect, it } from 'vitest';
import { canonicalizeUrl, domainOf } from '@/lib/retrieval/url';

describe('canonicalizeUrl', () => {
  it('produces the same key regardless of www, case, and tracking params', () => {
    const a = canonicalizeUrl('https://www.Lefaso.net/article?utm_source=x&id=3');
    const b = canonicalizeUrl('http://lefaso.net/article?id=3');
    expect(a).toBe(b);
  });

  it('produces the same key regardless of a trailing slash on the path', () => {
    const a = canonicalizeUrl('https://lefaso.net/article/');
    const b = canonicalizeUrl('http://lefaso.net/article');
    expect(a).toBe(b);
  });

  it('returns null for a non-http(s) protocol', () => {
    expect(canonicalizeUrl('ftp://example.com/file')).toBeNull();
  });

  it('returns null for a malformed URL', () => {
    expect(canonicalizeUrl('not a url')).toBeNull();
  });

  it('drops the fragment', () => {
    expect(canonicalizeUrl('https://example.com/a#section')).toBe('https://example.com/a');
  });
});

describe('domainOf', () => {
  it('strips www and lowercases', () => {
    expect(domainOf('https://WWW.Example.COM/path')).toBe('example.com');
  });

  it('returns an empty string for a malformed URL', () => {
    expect(domainOf('not a url')).toBe('');
  });
});
