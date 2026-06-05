/**
 * @module agents/search/faithfulness
 * @description Citation faithfulness gate (NLI).
 *
 * Bokari's core trust promise — "chaque affirmation vérifiée à sa source" —
 * lives here. After the writer produces an answer with `[n]` citation markers,
 * we decompose it into atomic cited claims and check, claim by claim, whether
 * the cited source extract actually *entails* the claim (natural-language
 * inference). This converts Perplexity's documented weakness (37-45% citation
 * errors, CJR) into a visible, per-claim "supported / partial / unsupported"
 * verdict.
 *
 * The check is LLM-as-NLI: a single structured `generateObject` call grades all
 * cited claims against their evidence. It is OPT-IN (`BOKARI_FAITHFULNESS_ENABLED`)
 * and runs *after* the answer has streamed, so it never blocks or alters the
 * answer text — it only appends a verdict the UI can badge.
 *
 * The parsing and scoring helpers are pure (no LLM, no network) so the contract
 * is unit-tested without API keys.
 */
import z from 'zod';
import BaseLLM from '@/lib/models/base/llm';

export type ClaimLabel = 'supported' | 'partial' | 'unsupported';

export interface CitedClaim {
  /** The claim sentence, citation markers stripped. */
  text: string;
  /** 1-based citation indices the sentence references (sorted, deduped). */
  citations: number[];
}

export interface ClaimVerdict extends CitedClaim {
  label: ClaimLabel;
  /** One short sentence justifying the verdict. */
  reason?: string;
}

export interface FaithfulnessReport {
  verdicts: ClaimVerdict[];
  /** Faithfulness score in 0..1 (partial counts as half credit). */
  score: number;
  supported: number;
  partial: number;
  unsupported: number;
  /** Total cited claims checked. */
  total: number;
}

/** Whether the citation faithfulness gate is enabled (opt-in). */
export function isFaithfulnessEnabled(): boolean {
  return process.env.BOKARI_FAITHFULNESS_ENABLED === 'true';
}

/** Max chars of a source extract handed to the verifier per citation. Keeps the
 *  NLI prompt bounded even when a cited page is long. */
const EVIDENCE_CHARS = 1200;

/** Split on sentence boundaries (., !, ?) followed by whitespace and a capital
 *  letter / digit / opening quote — keeps decimals and abbreviations mostly
 *  intact. Lookbehind is supported on Node 18+. */
const SENTENCE_SPLIT = /(?<=[.!?])\s+(?=[A-ZÀ-Þ0-9«"])/u;
const CITATION_RE = /\[(\d+)\]/g;

/**
 * Decompose an answer into the subset of sentences that carry `[n]` citations.
 * Only cited sentences are verifiable, so uncited prose is intentionally
 * dropped. Pure — no LLM.
 */
export function extractCitedClaims(answer: string): CitedClaim[] {
  if (!answer) return [];
  const sentences = answer
    .replace(/\s+/g, ' ')
    .split(SENTENCE_SPLIT)
    .map((s) => s.trim())
    .filter(Boolean);

  const claims: CitedClaim[] = [];
  for (const sentence of sentences) {
    const citations = new Set<number>();
    CITATION_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = CITATION_RE.exec(sentence)) !== null) {
      citations.add(Number(m[1]));
    }
    if (citations.size === 0) continue; // only cited claims are verifiable
    const text = sentence.replace(CITATION_RE, '').replace(/\s+/g, ' ').trim();
    if (text.length < 8) continue; // skip bare markers / trivial fragments
    claims.push({
      text,
      citations: [...citations].sort((a, b) => a - b),
    });
  }
  return claims;
}

/** Aggregate per-claim verdicts into a report. Partial = half credit. Pure. */
export function scoreFaithfulness(verdicts: ClaimVerdict[]): FaithfulnessReport {
  const total = verdicts.length;
  const supported = verdicts.filter((v) => v.label === 'supported').length;
  const partial = verdicts.filter((v) => v.label === 'partial').length;
  const unsupported = verdicts.filter((v) => v.label === 'unsupported').length;
  const score = total === 0 ? 1 : (supported + 0.5 * partial) / total;
  return { verdicts, score, supported, partial, unsupported, total };
}

const verdictSchema = z.object({
  verdicts: z.array(
    z.object({
      index: z
        .number()
        .describe('1-based index of the claim being judged (CLAIM N).'),
      label: z.enum(['supported', 'partial', 'unsupported']),
      reason: z.string().describe('One short sentence justifying the verdict.'),
    }),
  ),
});

const faithfulnessPrompt = `You are a strict citation-faithfulness verifier performing natural-language inference (NLI).
For each CLAIM you are given the EVIDENCE it cites (extracts from its sources). Decide whether the evidence supports the claim:
- "supported": the evidence clearly entails the claim.
- "partial": the evidence is on-topic and partly supports it, but a key fact (a number, name, date, or qualifier) is missing or only loosely implied.
- "unsupported": the evidence does not support the claim, contradicts it, or is irrelevant.
Judge ONLY against the provided evidence — never use outside knowledge. When in doubt between supported and partial, choose partial. Return a verdict for every claim, keyed by its index. Reasons must be one short sentence.`;

/** A source extract a claim may cite. */
export interface FaithfulnessSource {
  content: string;
  title?: string;
}

/**
 * Verify each cited claim in `answer` against its cited `sources` via NLI.
 * Never throws — on any failure it returns a neutral (empty) report so the
 * answer path is never broken. `sources` is 0-indexed; citation `[n]` maps to
 * `sources[n-1]`.
 */
export async function checkFaithfulness(
  answer: string,
  sources: FaithfulnessSource[],
  llm: BaseLLM<any>,
): Promise<FaithfulnessReport> {
  const claims = extractCitedClaims(answer);
  if (claims.length === 0) {
    return scoreFaithfulness([]);
  }

  const claimBlocks = claims
    .map((c, i) => {
      const evidence = c.citations
        .map((n) => {
          const src = sources[n - 1];
          return src
            ? `[${n}] ${src.content.slice(0, EVIDENCE_CHARS)}`
            : `[${n}] (source manquante)`;
        })
        .join('\n');
      return `CLAIM ${i + 1}: ${c.text}\nEVIDENCE:\n${evidence}`;
    })
    .join('\n\n');

  try {
    const out = await llm.generateObject<typeof verdictSchema>({
      messages: [
        { role: 'system', content: faithfulnessPrompt },
        { role: 'user', content: claimBlocks },
      ],
      schema: verdictSchema,
    });
    const byIndex = new Map(out.verdicts.map((v) => [v.index, v]));
    const verdicts: ClaimVerdict[] = claims.map((c, i) => {
      const v = byIndex.get(i + 1);
      return {
        ...c,
        label: v?.label ?? 'partial',
        reason: v?.reason,
      };
    });
    return scoreFaithfulness(verdicts);
  } catch (err) {
    console.warn('[Bokari] faithfulness check failed:', err);
    return scoreFaithfulness([]);
  }
}
