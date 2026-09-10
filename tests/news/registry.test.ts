/**
 * Unit tests for the C9 news corpus registry: shape invariants the crawler
 * and the future admin UI rely on. No DB, no network.
 */
import { describe, expect, it } from 'vitest';
import { EXCLUDED_DOMAINS, SOURCE_SEEDS } from '@/lib/news/registry';

describe('news registry', () => {
  it('has non-empty seeds with unique domains', () => {
    expect(SOURCE_SEEDS.length).toBeGreaterThan(20);
    const domains = SOURCE_SEEDS.map((s) => s.domain);
    expect(new Set(domains).size).toBe(domains.length);
  });

  it('every seed has a https feed URL matching its domain or an allowed alt host', () => {
    // BBC's articles live on bbc.com but its feed on feeds.bbci.co.uk.
    const FEED_HOST_ALIASES: Record<string, string[]> = {
      'bbc.com': ['feeds.bbci.co.uk'],
    };
    for (const s of SOURCE_SEEDS) {
      if (s.feedUrl === null) continue;
      expect(s.feedUrl.startsWith('https://')).toBe(true);
      const host = new URL(s.feedUrl).hostname.replace(/^www\./, '');
      const allowed = [s.domain, ...(FEED_HOST_ALIASES[s.domain] ?? [])];
      expect(allowed.some((d) => host === d || host.endsWith(`.${d}`))).toBe(
        true,
      );
    }
  });

  it('tier is 1..3 and certified sources are tier 1', () => {
    for (const s of SOURCE_SEEDS) {
      expect([1, 2, 3]).toContain(s.tier);
      if (s.isCertified) expect(s.tier).toBe(1);
    }
  });

  it('suspendedIn holds valid ISO-ish codes and banned outlets are labelled, not dropped', () => {
    for (const s of SOURCE_SEEDS) {
      for (const code of s.suspendedIn ?? []) {
        expect(code).toMatch(/^[A-Z]{2}$/);
      }
    }
    // RFI is banned in Mali/Burkina/Niger — kept in the corpus, labelled.
    const rfi = SOURCE_SEEDS.find((s) => s.domain === 'rfi.fr');
    expect(rfi?.suspendedIn).toEqual(['ML', 'BF', 'NE']);
  });

  it('country codes are 2-letter uppercase', () => {
    for (const s of SOURCE_SEEDS) {
      expect(s.country).toMatch(/^[A-Z]{2}$/);
    }
  });

  it('excluded domains are documented with a reason', () => {
    expect(Object.keys(EXCLUDED_DOMAINS).length).toBeGreaterThan(0);
    for (const reason of Object.values(EXCLUDED_DOMAINS)) {
      expect(reason.length).toBeGreaterThan(10);
    }
  });

  it('aggregators are tier 3 (dedup relies on it)', () => {
    for (const domain of ['maliweb.net', 'malijet.com', 'abidjan.net']) {
      const s = SOURCE_SEEDS.find((x) => x.domain === domain);
      expect(s?.tier).toBe(3);
    }
  });
});
