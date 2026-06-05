/**
 * Bokari blog — editorial categories (rubriques).
 *
 * The taxonomy of Bokari's news / fact-check blog. Each category carries its own
 * accent (a calm Canvas tint + readable ink) used for tags, bands and category
 * pages. Edit this list to add / rename / reorder rubriques — the index, the
 * category pages and the article badges all derive from it. `slug` is the URL
 * segment (/blog/categorie/<slug>) and the value stored on each Article.category.
 */

export type Category = {
  slug: string;
  label: string;
  /** Short label for tight spaces (nav chips). Falls back to `label`. */
  short?: string;
  /** One line — shown on the category page header + used as its meta description. */
  description: string;
  /** Accent: light tint (bg), edge (border) and ink (text) — all readable on white paper. */
  tint: string;
  edge: string;
  ink: string;
};

export const CATEGORIES: Category[] = [
  {
    slug: 'fact-check',
    label: 'Fact-check',
    description:
      'Les intox passées au crible : Bokari recoupe les sources et démêle le vrai du faux.',
    tint: '#ccfbf1',
    edge: '#5eead4',
    ink: '#0f766e',
  },
  {
    slug: 'economie',
    label: 'Économie',
    description:
      'Argent, marchés, mobile money et emploi — décryptés et vérifiés, chaque chiffre sourcé.',
    tint: '#fdf0b0',
    edge: '#f3df7a',
    ink: '#854d0e',
  },
  {
    slug: 'politique',
    label: 'Politique',
    description:
      'Décisions, élections et institutions du continent — les faits, recoupés et cités.',
    tint: '#ffd9b8',
    edge: '#ffc18e',
    ink: '#9a3412',
  },
  {
    slug: 'tech',
    label: 'Tech & Numérique',
    short: 'Tech',
    description:
      "Innovation, IA, startups et connectivité en Afrique — vérifié, sans la hype.",
    tint: '#cdeefb',
    edge: '#a6dcf3',
    ink: '#075985',
  },
  {
    slug: 'societe',
    label: 'Société',
    description:
      "Santé, éducation, environnement et vie quotidienne — l'info utile, vérifiée.",
    tint: '#ffd4e1',
    edge: '#ffb3c9',
    ink: '#9d174d',
  },
  {
    slug: 'international',
    label: 'International',
    description:
      "L'Afrique dans le monde et le monde vu d'Afrique — les faits, sourcés.",
    tint: '#c8f4e0',
    edge: '#93e6c4',
    ink: '#065f46',
  },
];

export function getCategory(slug: string): Category | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}

export function getCategorySlugs(): string[] {
  return CATEGORIES.map((c) => c.slug);
}
