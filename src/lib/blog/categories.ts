/**
 * Bokari blog — editorial categories (rubriques).
 *
 * These six beats are the canonical taxonomy of Bokari's autonomous news blog.
 * The article generator rotates through them (one fresh article every 5h, full
 * tour in 30h). Each carries its own Canvas accent (a calm tint + readable ink)
 * used for tags, bands and category pages. `slug` is the URL segment
 * (/blog/categorie/<slug>) and the value stored on each Article.category.
 *
 * Edit this list to add / rename / reorder rubriques — the index, the category
 * pages, the article badges AND the generator's rotation all derive from it.
 */

export type Category = {
  slug: string;
  label: string;
  /** Short label for tight spaces (nav chips). Falls back to `label`. */
  short?: string;
  /** One line — shown on the category page header + used as its meta description. */
  description: string;
  /** Search seeds the autonomous generator uses to look for fresh news in this beat. */
  searchSeeds: string[];
  /** Accent: light tint (bg), edge (border) and ink (text) — all readable on white paper. */
  tint: string;
  edge: string;
  ink: string;
};

export const CATEGORIES: Category[] = [
  {
    slug: 'politique',
    label: 'Politique',
    description:
      'Décisions, élections et institutions du continent — les faits, recoupés et cités.',
    searchSeeds: [
      'actualité politique Afrique cette semaine',
      'élections gouvernement Afrique',
      'Union africaine CEDEAO décision récente',
    ],
    tint: '#ffd9b8',
    edge: '#ffc18e',
    ink: '#9a3412',
  },
  {
    slug: 'tech-science',
    label: 'Tech & Science',
    short: 'Tech',
    description:
      "Innovation, IA, startups, recherche et santé en Afrique — vérifié, sans la hype.",
    searchSeeds: [
      'startup tech Afrique actualité',
      'intelligence artificielle innovation Afrique',
      'science recherche santé Afrique nouvelle',
    ],
    tint: '#cdeefb',
    edge: '#a6dcf3',
    ink: '#075985',
  },
  {
    slug: 'sport',
    label: 'Sport',
    description:
      'Football, CAN, athlétisme et exploits africains — résultats et coulisses, vérifiés.',
    searchSeeds: [
      'actualité football africain cette semaine',
      'sport Afrique résultats CAN',
      'athlète africain compétition récente',
    ],
    tint: '#ffd4d4',
    edge: '#ffb3b3',
    ink: '#9f1239',
  },
  {
    slug: 'art-culture',
    label: 'Art & Culture',
    short: 'Culture',
    description:
      "Musique, cinéma, mode, littérature et patrimoine — la création africaine qui rayonne.",
    searchSeeds: [
      'culture africaine actualité musique cinéma',
      'artiste africain festival sortie récente',
      'patrimoine mode littérature Afrique',
    ],
    tint: '#e9d5ff',
    edge: '#d8b4fe',
    ink: '#6b21a8',
  },
  {
    slug: 'business',
    label: 'Business',
    description:
      'Économie, marchés, mobile money, investissement et emploi — chaque chiffre sourcé.',
    searchSeeds: [
      'économie Afrique actualité business',
      'investissement startup levée de fonds Afrique',
      'marché mobile money commerce Afrique',
    ],
    tint: '#fdf0b0',
    edge: '#f3df7a',
    ink: '#854d0e',
  },
  {
    slug: 'agriculture',
    label: 'Agriculture',
    short: 'Agri',
    description:
      "Cultures, élevage, agritech, sécurité alimentaire et climat — le terrain qui nourrit le continent.",
    searchSeeds: [
      'agriculture Afrique actualité récolte',
      'sécurité alimentaire agritech Afrique',
      'élevage culture climat agriculture Afrique',
    ],
    tint: '#c8f4e0',
    edge: '#93e6c4',
    ink: '#065f46',
  },
];

/** Category slugs in rotation order — drives the every-5h generator cursor. */
export const CATEGORY_ORDER: string[] = CATEGORIES.map((c) => c.slug);

export function getCategory(slug: string): Category | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}

export function getCategorySlugs(): string[] {
  return CATEGORIES.map((c) => c.slug);
}
