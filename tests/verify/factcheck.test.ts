import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  looksLikeFactCheckIntent,
  searchFactChecks,
  isFactCheckConfigured,
  TRUSTED_PUBLISHERS,
} from '@/lib/verify/factcheck';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.GOOGLE_FACTCHECK_API_KEY;
});

describe('looksLikeFactCheckIntent', () => {
  it('detects explicit verification phrasings', () => {
    expect(
      looksLikeFactCheckIntent('Est-il vrai que le Mali a signé un accord ?'),
    ).toBe(true);
    expect(
      looksLikeFactCheckIntent('Est-ce vrai que les visas sont suspendus ?'),
    ).toBe(true);
    expect(
      looksLikeFactCheckIntent('La rumeur sur l’or du Burkina, qu’en est-il ?'),
    ).toBe(true);
    expect(
      looksLikeFactCheckIntent(
        'Quel est le démenti officiel sur cette affaire ?',
      ),
    ).toBe(true);
  });

  it('detects interrogative assertions ("X a-t-il vraiment…?")', () => {
    expect(
      looksLikeFactCheckIntent('Le Mali a-t-il vraiment renversé l’Espagne ?'),
    ).toBe(true);
  });

  it('rejects ordinary searches', () => {
    expect(looksLikeFactCheckIntent('actualité Mali aujourd’hui')).toBe(false);
    expect(looksLikeFactCheckIntent('prix du mil à Bankass')).toBe(false);
    expect(looksLikeFactCheckIntent('')).toBe(false);
  });
});

describe('searchFactChecks', () => {
  it('returns [] without an API key (never throws, never blocks)', async () => {
    delete process.env.GOOGLE_FACTCHECK_API_KEY;
    const result = await searchFactChecks('le mali a signé un accord');
    expect(result).toEqual([]);
  });

  it('returns [] on an empty query', async () => {
    process.env.GOOGLE_FACTCHECK_API_KEY = 'test-key';
    const result = await searchFactChecks('   ');
    expect(result).toEqual([]);
  });

  it('parses claims and flags trusted IFCN publishers', async () => {
    process.env.GOOGLE_FACTCHECK_API_KEY = 'test-key';
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              claims: [
                {
                  text: 'Le Mali a quitté la CEDEAO en 2024',
                  claimReview: [
                    {
                      url: 'https://africacheck.org/fact-checks/mali-exit',
                      textualRating: 'Faux',
                      reviewDate: '2024-02-10T00:00:00Z',
                      publisher: {
                        name: 'Africa Check',
                        site: 'africacheck.org',
                      },
                    },
                  ],
                },
                {
                  text: 'Une affirmation inconnue',
                  claimReview: [
                    {
                      url: 'https://inconnu.example/post',
                      textualRating: 'Trompeur',
                      publisher: { name: 'Inconnu', site: 'inconnu.example' },
                    },
                  ],
                },
                // No review → skipped entirely.
                { text: 'Sans review' },
              ],
            }),
            { status: 200 },
          ),
      ),
    );

    const result = await searchFactChecks('le mali a quitté la cedeao');
    expect(result).toHaveLength(2);
    expect(result[0]!.trusted).toBe(true);
    expect(result[0]!.publisher).toBe('Africa Check');
    expect(result[0]!.rating).toBe('Faux');
    expect(result[0]!.reviewedAt?.getUTCFullYear()).toBe(2024);
    expect(result[1]!.trusted).toBe(false);
  });

  it('returns [] on a non-200 response or network failure', async () => {
    process.env.GOOGLE_FACTCHECK_API_KEY = 'test-key';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('nope', { status: 500 })),
    );
    expect(await searchFactChecks('test')).toEqual([]);

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('ECONNRESET');
      }),
    );
    expect(await searchFactChecks('test')).toEqual([]);
  });

  it('strips www. from publisher sites before the trusted check', async () => {
    process.env.GOOGLE_FACTCHECK_API_KEY = 'test-key';
    expect(TRUSTED_PUBLISHERS.has('fasocheck.org')).toBe(true);
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              claims: [
                {
                  text: 'x',
                  claimReview: [
                    {
                      url: 'https://x/1',
                      publisher: { site: 'www.fasocheck.org' },
                    },
                  ],
                },
              ],
            }),
            { status: 200 },
          ),
      ),
    );
    const result = await searchFactChecks('x');
    expect(result[0]!.publisherSite).toBe('fasocheck.org');
    expect(result[0]!.trusted).toBe(true);
  });
});

describe('isFactCheckConfigured', () => {
  it('reflects the env var', () => {
    delete process.env.GOOGLE_FACTCHECK_API_KEY;
    expect(isFactCheckConfigured()).toBe(false);
    process.env.GOOGLE_FACTCHECK_API_KEY = 'k';
    expect(isFactCheckConfigured()).toBe(true);
  });
});
