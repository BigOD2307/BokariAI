/**
 * C7 — the mechanical half of "Ne crois rien. Verifie tout." The writer is
 * not trusted to respect the [S1]/[S2] citation contract (`evidence.ts`);
 * the contract is enforced here, once, after the answer has fully streamed.
 */
import type { EvidenceSource } from './evidence';

const CITATION_RE = /\[(S\d{1,3})\]/g;
/** A sentence carrying a number or a year looks like a factual claim; an
 *  unsourced one is worth flagging. */
const FACTUAL_RE = /\d|\b(19|20)\d{2}\b/;

export type CitationAudit = {
  /** The answer with unknown references removed. */
  text: string;
  /** Sources actually cited, in order of first appearance. */
  cited: EvidenceSource[];
  /** References the model invented. Non-empty means the prompt needs work. */
  invented: string[];
  /** Factual sentences with no valid citation. */
  unsourcedClaims: string[];
};

/**
 * Reconcile what the model wrote with what it was actually given.
 */
export function auditCitations(
  answer: string,
  sources: EvidenceSource[],
): CitationAudit {
  const known = new Map(sources.map((s) => [s.id, s]));
  const invented = new Set<string>();
  const citedOrder: EvidenceSource[] = [];
  const seen = new Set<string>();

  const text = answer.replace(CITATION_RE, (match, id: string) => {
    const source = known.get(id);
    if (!source) {
      invented.add(id);
      return ''; // drop it: a dangling reference is worse than none
    }
    if (!seen.has(id)) {
      seen.add(id);
      citedOrder.push(source);
    }
    return match;
  });

  // Reset lastIndex: CITATION_RE is a global regex reused above via .test().
  CITATION_RE.lastIndex = 0;

  const unsourcedClaims = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 40 && FACTUAL_RE.test(s) && !CITATION_RE.test(s));

  CITATION_RE.lastIndex = 0;

  return {
    text: tidy(text),
    cited: citedOrder,
    invented: [...invented],
    unsourcedClaims,
  };
}

function tidy(text: string): string {
  return text.replace(/[ \t]{2,}/g, ' ').replace(/\s+([.,;:])/g, '$1').trim();
}
