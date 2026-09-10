/**
 * C8 — Citation faithfulness gate, per-claim, with showable proof.
 *
 * Bokari's promise is "chaque affirmation vérifiée à sa source". This module
 * makes that promise mechanical: after the writer's answer has streamed, each
 * cited sentence is checked against the passages of the sources IT cites, and
 * a "supported" verdict must come with a VERBATIM quote from those passages.
 * A model that claims evidence supports a sentence but cannot copy the sentence
 * that does it is guessing — such a verdict is downgraded to `partial`.
 *
 * Hard rules that differ from the old gate:
 *  - An unjudged claim is `unsupported`, never `partial` (silence is not
 *    evidence; defaulting to partial flattered the answer).
 *  - A quote is verified literally (normalised substring match) before it is
 *    shown. We never display a "proof" that is not in the source.
 *  - On failure the report says `unavailable` — the UI shows nothing rather
 *    than a reassuring badge computed from missing data.
 *
 * The check runs after the answer has fully streamed, never alters the text,
 * and the resulting report is persisted inside `response_blocks` (see
 * `FaithfulnessBlock` in src/lib/types.ts) so it survives reloads and shows
 * up in public shares.
 */
import z from 'zod';
import type BaseLLM from '@/lib/models/base/llm';
import { ROLE_OPTIONS } from '@/lib/ai/roles';

export type ClaimVerdict = 'supported' | 'partial' | 'unsupported';

export interface CheckedClaim {
  /** The claim sentence, citation markers stripped. */
  text: string;
  /** Stable source ids the sentence cites (e.g. ['S1', 'S3']). */
  sourceIds: string[];
  verdict: ClaimVerdict;
  /** Verbatim excerpt from a cited source that carries the claim. Empty for
   *  anything not `supported`. This is what the reader sees as proof. */
  quote: string;
}

export interface FaithfulnessReport {
  claims: CheckedClaim[];
  supported: number;
  partial: number;
  unsupported: number;
  total: number;
  /** Set when the check could not run. The UI then renders nothing — never a
   *  green badge computed from missing data. */
  unavailable?: string;
}

/** Whether the faithfulness gate should run for this request. On by default
 *  since C8; the flag exists to turn it off in an emergency. */
export function isFaithfulnessEnabled(): boolean {
  return process.env.BOKARI_FAITHFULNESS_ENABLED !== 'false';
}

/** Max chars of evidence handed to the verifier per claim. Bounds the prompt. */
const EVIDENCE_CHARS = 4_000;
/** Sentences shorter than this are trivial fragments, not checkable claims. */
const MIN_CLAIM_CHARS = 40;

const CITATION_RE = /\[(S\d{1,3})\]/g;
const SENTENCE_SPLIT = /(?<=[.!?])\s+(?=[A-ZÀ-Þ0-9«"'])/u;

export interface FaithfulnessSource {
  id: string;
  passages: string[];
}

/**
 * Extract the verifiable subset of an answer: sentences long enough to be
 * claims and carrying at least one `[Sn]` citation. Pure — no LLM, no network.
 */
export function extractClaims(
  answer: string,
): Array<{ text: string; sourceIds: string[] }> {
  if (!answer) return [];
  const sentences = answer
    .replace(/\s+/g, ' ')
    .split(SENTENCE_SPLIT)
    .map((s) => s.trim())
    .filter(Boolean);

  const claims: Array<{ text: string; sourceIds: string[] }> = [];
  for (const sentence of sentences) {
    const ids = [...sentence.matchAll(CITATION_RE)].map((m) => m[1]);
    CITATION_RE.lastIndex = 0;
    if (ids.length === 0) continue; // uncited prose is not checkable
    const text = sentence.replace(CITATION_RE, '').replace(/\s+/g, ' ').trim();
    if (text.length < MIN_CLAIM_CHARS) continue;
    claims.push({ text, sourceIds: [...new Set(ids)] });
  }
  return claims;
}

const verdictSchema = z.object({
  results: z.array(
    z.object({
      /** 1-based index of the claim being judged (AFFIRMATION N). */
      index: z.number().int().min(1),
      verdict: z.enum(['supported', 'partial', 'unsupported']),
      /** Exact copy of the sentence in the excerpts that supports the claim.
       *  Must be empty for `unsupported`. */
      quote: z.string().max(400),
    }),
  ),
});

const SYSTEM = `Tu vérifies si des affirmations sont soutenues par les extraits fournis.

Pour chaque affirmation, réponds :
- "supported" si un extrait l'établit, et donne la citation EXACTE (copiée mot pour mot) qui le fait.
- "partial" si un extrait la soutient en partie ou avec une nuance (chiffre approché, période différente).
- "unsupported" si aucun extrait ne l'établit. Dans ce cas, quote doit être vide.

Ne juge PAS si l'affirmation est vraie dans l'absolu : uniquement si les extraits la portent.
La citation doit être copiée telle quelle depuis un extrait, jamais reformulée.`;

function normalise(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').replace(/[’']/g, "'").trim();
}

/**
 * Check each cited sentence against the passages of the sources IT cites.
 * Never throws — on any failure it returns an honest `unavailable` report.
 */
export async function checkFaithfulness(
  answer: string,
  sources: FaithfulnessSource[],
  llm: BaseLLM<any>,
): Promise<FaithfulnessReport> {
  const claims = extractClaims(answer);
  if (claims.length === 0) {
    return { claims: [], supported: 0, partial: 0, unsupported: 0, total: 0 };
  }

  const byId = new Map(sources.map((s) => [s.id, s]));

  const payload = claims
    .map((claim, index) => {
      const excerpts = claim.sourceIds
        .flatMap((id) => byId.get(id)?.passages ?? [])
        .join('\n---\n')
        .slice(0, EVIDENCE_CHARS);
      return `AFFIRMATION ${index + 1}: ${claim.text}\nEXTRAITS:\n${excerpts || '(aucun extrait disponible)'}`;
    })
    .join('\n\n===\n\n');

  let parsed: z.infer<typeof verdictSchema>;
  try {
    parsed = await llm.generateObject<typeof verdictSchema>({
      schema: verdictSchema,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: payload },
      ],
      options: ROLE_OPTIONS.extractor,
    });
  } catch (err) {
    return {
      claims: [],
      supported: 0,
      partial: 0,
      unsupported: claims.length,
      total: claims.length,
      unavailable: (err as Error).message,
    };
  }

  const results = new Map(parsed.results.map((r) => [r.index, r]));

  const checked: CheckedClaim[] = claims.map((claim, index) => {
    const result = results.get(index + 1);
    if (!result) {
      // The judge skipped it — that is not evidence of support.
      return { ...claim, verdict: 'unsupported', quote: '' };
    }
    // A quote the model paraphrased is not a quote. Verify it literally
    // against the passages of the very sources the claim cites.
    const passages = claim.sourceIds.flatMap((id) => byId.get(id)?.passages ?? []);
    const quoteIsReal =
      result.verdict === 'supported' &&
      result.quote.length > 15 &&
      passages.some((p) => normalise(p).includes(normalise(result.quote)));

    if (result.verdict === 'supported' && !quoteIsReal) {
      return { ...claim, verdict: 'partial', quote: '' };
    }
    return {
      ...claim,
      verdict: result.verdict,
      quote: quoteIsReal ? result.quote : '',
    };
  });

  return {
    claims: checked,
    supported: checked.filter((c) => c.verdict === 'supported').length,
    partial: checked.filter((c) => c.verdict === 'partial').length,
    unsupported: checked.filter((c) => c.verdict === 'unsupported').length,
    total: checked.length,
  };
}
