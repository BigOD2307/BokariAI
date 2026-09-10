/**
 * C8 — Fact-check cross-referencing via the Google Fact Check Tools API.
 *
 * The public index of ClaimReview markup published by the IFCN signatories
 * that matter here: Africa Check, AFP Factuel, Fasocheck, Congo Check,
 * PesaCheck, Benbere. When a claim has already been checked by a human
 * organisation, saying so with a link beats any model verdict.
 *
 * https://developers.google.com/fact-check/tools/api
 *
 * Behaviour:
 *  - No key configured, network error, or bad response → [] — the answer
 *    path never depends on this working.
 *  - Publishers are matched by site domain; the IFCN / francophone-Africa
 *    fact-checkers we recognise are flagged `trusted` and shown by name.
 */
const ENDPOINT = 'https://factchecktools.googleapis.com/v1alpha1/claims:search';

export type FactCheck = {
  claim: string;
  publisher: string;
  publisherSite: string;
  rating: string;
  url: string;
  reviewedAt: Date | null;
  /** True when the publisher is an IFCN signatory we recognise. */
  trusted: boolean;
};

/** IFCN signatories and francophone-Africa fact-checkers we surface by name. */
export const TRUSTED_PUBLISHERS = new Set([
  'africacheck.org',
  'factuel.afp.com',
  'fasocheck.org',
  'congocheck.net',
  'pesacheck.org',
  'benbere.org',
  'lejalon.com',
  'togocheck.com',
  'balobakicheck.com',
  'ivoirecheck.com',
]);

export function isFactCheckConfigured(): boolean {
  return Boolean(process.env.GOOGLE_FACTCHECK_API_KEY);
}

export async function searchFactChecks(
  query: string,
  opts: { language?: string; maxAgeDays?: number } = {},
): Promise<FactCheck[]> {
  const key = process.env.GOOGLE_FACTCHECK_API_KEY;
  const trimmed = query.trim();
  if (!key || !trimmed) return [];

  const url = new URL(ENDPOINT);
  url.searchParams.set('key', key);
  url.searchParams.set('query', trimmed.slice(0, 200));
  url.searchParams.set('languageCode', opts.language ?? 'fr');
  url.searchParams.set('pageSize', '10');
  if (opts.maxAgeDays)
    url.searchParams.set('maxAgeDays', String(opts.maxAgeDays));

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5_000) });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      claims?: Array<{
        text?: string;
        claimReview?: Array<{
          url?: string;
          textualRating?: string;
          reviewDate?: string;
          publisher?: { name?: string; site?: string };
        }>;
      }>;
    };

    return (json.claims ?? []).flatMap((claim) => {
      const review = claim.claimReview?.[0];
      if (!review?.url) return [];
      const site = (review.publisher?.site ?? '')
        .toLowerCase()
        .replace(/^www\./, '');
      return [
        {
          claim: claim.text ?? '',
          publisher: review.publisher?.name ?? site,
          publisherSite: site,
          rating: review.textualRating ?? '',
          url: review.url,
          reviewedAt: review.reviewDate ? new Date(review.reviewDate) : null,
          trusted: TRUSTED_PUBLISHERS.has(site),
        },
      ];
    });
  } catch {
    // Fact-checking is an enhancement, never a dependency.
    return [];
  }
}

/**
 * Does the question read like a claim to verify? Used to trigger the
 * fact-check lookup in parallel with the search, only when it can add
 * something. French-first patterns: "est-il vrai que", "vraiment",
 * "rumeur", "démenti", "fake", and bare factual assertions with a
 * question mark.
 */
const FACTCHECK_INTENT_RE =
  /(est[- ]ce (vrai|faux|exact)|est[- ]il vrai|vraiment|rumeur|d[ée]menti|intox|fake news|hoax|v[ée]ridi[ée])/i;

export function looksLikeFactCheckIntent(question: string): boolean {
  if (!question) return false;
  if (FACTCHECK_INTENT_RE.test(question)) return true;
  // A short interrogative asserting a fact: "Le Mali a-t-il signé…?"
  return /\?/.test(question) && /-t-|est-ce que/i.test(question);
}
