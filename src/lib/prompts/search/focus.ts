import type { ClassifierOutput, SearchFocus } from '@/lib/agents/search/types';

/**
 * Focus directives — the researcher's per-intent briefing. A focus never
 * replaces the agentic loop; it biases it (which tool first, what counts
 * as a good answer) the way a desk editor briefs a reporter.
 */
export const FOCUS_DIRECTIVES: Record<
  Exclude<SearchFocus, 'auto'>,
  string
> = {
  actu: `FOCUS ACTU — l'utilisateur veut l'actualité fraîche. Commence par news_corpus_search (presse africaine), pas par le web général. Privilégie les sources de moins de 7 jours. Chaque fait doit être daté dans la réponse (« le 10 septembre »). Si le corpus ne couvre pas le sujet, complète par le web en le signalant.`,
  marches: `FOCUS MARCHÉS — l'utilisateur veut des chiffres et des prix. Donne des montants précis avec leur date et leur lieu (« le mil à Bamako, septembre 2026 »). Croise toujours deux sources pour chaque prix : si elles divergent, donne les deux. Signale la devise (FCFA, GNF, etc.). Un chiffre sans date est un mauvais chiffre.`,
  demarches: `FOCUS DÉMARCHES — l'utilisateur veut accomplir une procédure administrative. Privilégie les sources officielles (sites .gouv.ml/.gouv.sn, services publics, communiqués). Réponds en étapes numérotées : pièces à fournir, lieu, coût, délai. Si la procédure varie selon le pays ou la région, précise-le. N'invente jamais une pièce ou un tarif.`,
  examens: `FOCUS EXAMENS — l'utilisateur prépare un examen ou concours (BAC, DEF, CFEE, concours). Privilégie les programmes et calendriers officiels (ministères de l'éducation). Donne les dates exactes, les matières/épreuves et les coefficients quand ils sont connus. Propose une méthode de révision concrète adaptée au niveau.`,
};

/** The researcher-prompt section for a focus, or '' when focus is 'auto'. */
export function focusDirective(focus: SearchFocus): string {
  if (focus === 'auto') return '';
  return `\n<focus>\n${FOCUS_DIRECTIVES[focus]}\n</focus>\n`;
}

/**
 * Classifier override for a user-chosen focus. Pure (returns a copy) so it
 * is unit-testable without an LLM. 'actu' forces the fresh-news path
 * (corpus first); other focuses only brief the researcher via the prompt.
 */
export function applyFocusToClassification(
  classification: ClassifierOutput,
  focus: SearchFocus,
): ClassifierOutput {
  if (focus !== 'actu') return classification;
  return {
    ...classification,
    classification: { ...classification.classification, newsSearch: true },
  };
}
