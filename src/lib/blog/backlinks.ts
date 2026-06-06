/**
 * Deterministic backlink injection — the SAFE way to add links to generated
 * articles.
 *
 * The model NEVER emits link URLs (it would hallucinate slugs and brand paths).
 * It writes natural prose with [n] citations only; this pass runs AFTER
 * pruneAndRenumber and BEFORE persisting, and adds:
 *   1. INTERNAL links to OTHER already-published Bokari articles — only when a
 *      candidate article's title key-phrase appears VERBATIM in the new body
 *      (so the anchor is text the journalist already wrote, and the target is
 *      provably relevant). Slugs come from real published rows → 404s are
 *      structurally impossible.
 *   2. BRAND links (Dicken AI / Floo / ZeroName / Bokari) — only when the
 *      article's category is in the brand's allow-list, a topical trigger
 *      matches, AND the brand name already appears naturally in the prose.
 *      Most articles get ZERO brand links by design.
 *
 * Caps, placement exclusions (headings, citations, existing links, the lede,)
 * and idempotency are all enforced here. See the research in
 * workflow wf_a9c2ba7a-c80 for the rationale.
 */
import { listArticles } from './store';

export type BrandEntry = {
  name: string;
  /** Verified production URL, or null (e.g. Bokari has no public domain yet). */
  url: string | null;
  /** One-line description (shown to the model so it can name the brand aptly). */
  description: string;
  /** When it's genuinely relevant to mention (guidance for the model). */
  relevantWhen: string;
  /** Beats where this brand may EVER be linked. */
  categories: string[];
  /** Topical trigger — the body must match for the brand to be eligible. */
  trigger: RegExp;
};

/** Verified registry (URLs confirmed via research wf_a9c2ba7a-c80). The model
 *  never sees these URLs — it can only name a brand; we add the href. */
export const BRAND_REGISTRY: BrandEntry[] = [
  {
    name: 'Dicken AI',
    url: 'https://dickenai.com',
    description: "le laboratoire d'IA africain (éditeur de Bokari) qui construit des produits IA pensés pour l'Afrique",
    relevantWhen: "un article parle d'IA africaine, de l'écosystème tech local, de startups ou d'innovation",
    categories: ['tech-science', 'business'],
    trigger: /intelligence artificielle|laboratoire ia|ia africaine|startup ia|deeptech|deep tech|écosystème ia/i,
  },
  {
    name: 'Floo',
    url: 'https://floo.digital',
    description: "l'assistant IA sur WhatsApp pour les pros et PME francophones d'Afrique (recherche, documents, voix), payable en FCFA",
    relevantWhen: "un article parle de productivité, d'outils pour PME, d'assistants IA, de WhatsApp au travail ou d'automatisation",
    categories: ['business', 'tech-science', 'agriculture'],
    trigger: /paiement|transfert d'argent|fintech|mobile money|assistant ia|whatsapp|productivité|pme|petite entreprise/i,
  },
  {
    name: 'ZeroName',
    url: 'https://zeroname.space',
    description: "la plateforme carrière IA pour chercheurs d'emploi (matching CV/offre, générateur de CV, entretiens blancs)",
    relevantWhen: "un article parle d'emploi, de chômage, de recrutement, de CV ou de carrière des jeunes",
    categories: ['business', 'tech-science'],
    trigger: /emploi|recrutement|\bcv\b|chercheur d'emploi|marché du travail|carrière|chômage|diplômé/i,
  },
  {
    name: 'Bokari',
    url: null, // no public marketing domain yet → left as an unlinked mention
    description: "le moteur de recherche IA africain qui vérifie l'info et cite ses sources (ce média)",
    relevantWhen: "un article parle de recherche d'information par IA, de fact-checking ou de désinformation",
    categories: ['tech-science'],
    trigger: /recherche ia|fact[- ]?check|moteur de recherche|désinformation|fausse information|intox/i,
  },
];

/** Brand fiche shown to the model for a given category (names + when relevant,
 *  NEVER URLs — the model only names a brand; the deterministic pass links it). */
export function brandFiche(category: string): string {
  const eligible = BRAND_REGISTRY.filter((b) => b.categories.includes(category));
  if (eligible.length === 0) return '';
  return eligible
    .map((b) => `- ${b.name} : ${b.description}. Pertinent si ${b.relevantWhen}.`)
    .join('\n');
}

const FR_STOPWORDS = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'au', 'aux', 'et', 'en',
  'à', 'dans', 'par', 'pour', 'sur', 'sous', 'avec', 'sans', 'que', 'qui',
  'quoi', 'dont', 'où', 'ce', 'ces', 'cette', 'cet', 'son', 'sa', 'ses', 'leur',
  'leurs', 'ne', 'pas', 'plus', 'ou', 'mais', 'donc', 'or', 'ni', 'car', 'est',
  'sont', 'a', 'ont', 'se', 'sa', 'il', 'elle', 'ils', 'elles', 'on', 'nous',
  'vous', 'comme', 'entre', 'vers', 'chez', 'aussi', 'tout', 'tous', 'toute',
]);
// Generic news words that must not anchor a link on their own.
const GENERIC = new Set([
  'afrique', 'africain', 'africaine', 'africains', 'africaines', 'actualite',
  'actualité', 'article', 'news', 'pays', 'continent', 'monde',
]);

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '');
}
function norm(s: string): string {
  return stripAccents(s.toLowerCase());
}
function isStop(w: string): boolean {
  const n = norm(w);
  return n.length < 3 || FR_STOPWORDS.has(n) || GENERIC.has(n);
}
function tokens(s: string): Set<string> {
  return new Set(
    norm(s)
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 3 && !FR_STOPWORDS.has(t) && !GENERIC.has(t)),
  );
}

/** Multi-word key-phrases from a title (longest first), each ≥2 words, ≥6 chars,
 *  with ≥2 meaningful (non-stopword) tokens — these are the only allowed anchors. */
function titlePhrases(title: string): string[] {
  const words = title
    .replace(/[«»"“”]/g, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''))
    .filter(Boolean);
  const out: string[] = [];
  for (let len = Math.min(4, words.length); len >= 2; len--) {
    for (let i = 0; i + len <= words.length; i++) {
      const gram = words.slice(i, i + len);
      if (isStop(gram[0]) || isStop(gram[gram.length - 1])) continue;
      const meaningful = gram.filter((w) => !isStop(w));
      if (meaningful.length < 2) continue;
      const phrase = gram.join(' ');
      if (phrase.length < 6) continue;
      if (/[[\]()|]/.test(phrase)) continue;
      out.push(phrase);
    }
  }
  return Array.from(new Set(out));
}

/** Spans (markdown links + [n] citations + heading lines) where a link must NOT go. */
function protectedSpans(body: string): Array<[number, number]> {
  const spans: Array<[number, number]> = [];
  const linkRe = /\[[^\]]*\]\([^)]*\)/g;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(body))) spans.push([m.index, m.index + m[0].length]);
  const citeRe = /\[\d+\]/g;
  while ((m = citeRe.exec(body))) spans.push([m.index, m.index + m[0].length]);
  const headRe = /^#{1,6}.*$/gm;
  while ((m = headRe.exec(body))) spans.push([m.index, m.index + m[0].length]);
  return spans;
}
function inSpan(idx: number, end: number, spans: Array<[number, number]>): boolean {
  return spans.some(([s, e]) => idx < e && end > s);
}

/** End offset of the first sentence (keep the lede link-free). */
function firstSentenceEnd(body: string): number {
  const m = body.match(/[.!?]\s/);
  return m ? (m.index ?? 0) + 1 : Math.min(body.length, 160);
}

/**
 * Find the first valid case-insensitive occurrence of `needle` in `body` that
 * is not inside a protected span and not in the lede. Returns the index in the
 * ORIGINAL body, or -1.
 */
function findInsertable(
  body: string,
  needle: string,
  spans: Array<[number, number]>,
  ledeEnd: number,
): number {
  const hay = norm(body);
  const ndl = norm(needle);
  let from = 0;
  while (from <= hay.length) {
    const idx = hay.indexOf(ndl, from);
    if (idx < 0) return -1;
    const end = idx + ndl.length;
    if (idx >= ledeEnd && !inSpan(idx, end, spans)) return idx;
    from = idx + 1;
  }
  return -1;
}

export type InjectOptions = {
  category: string;
  /** The article's own slug (excluded from internal candidates). */
  currentSlug?: string;
};

/**
 * Inject internal + brand backlinks into `body`. Pure string work over the real
 * published-article set + the verified brand registry — no LLM, no network
 * beyond the SQLite read. Idempotent and safe to re-run.
 */
export async function injectBacklinks(
  body: string,
  opts: InjectOptions,
): Promise<string> {
  let out = body;

  // Internal-link budget scales with length (research: 2-5 / 1000 words).
  const wordCount = out.split(/\s+/).filter(Boolean).length;
  const internalCap =
    wordCount < 400 ? 1 : Math.min(5, Math.max(2, Math.floor(wordCount / 250)));

  // ---- Internal links ----------------------------------------------------
  let published: { slug: string; title: string; category: string }[] = [];
  try {
    const rows = await listArticles({ status: 'published' });
    published = rows
      .filter((r) => r.slug !== opts.currentSlug)
      .map((r) => ({ slug: r.slug, title: r.title, category: r.category }));
  } catch {
    published = [];
  }

  const bodyToks = tokens(out);
  type Cand = { slug: string; phrase: string; score: number };
  const cands: Cand[] = [];
  const ledeEnd0 = firstSentenceEnd(out);
  for (const art of published) {
    const shared = [...tokens(art.title)].filter((t) => bodyToks.has(t)).length;
    if (shared < 2) continue;
    // Pick the longest title phrase that actually appears in the body.
    let best = '';
    for (const ph of titlePhrases(art.title)) {
      if (findInsertable(out, ph, protectedSpans(out), ledeEnd0) >= 0) {
        best = ph;
        break;
      }
    }
    if (!best) continue;
    const score = 3 + shared + (art.category === opts.category ? 1.5 : 0);
    cands.push({ slug: art.slug, phrase: best, score });
  }
  cands.sort((a, b) => b.score - a.score);

  const usedSlugs = new Set<string>();
  let internalCount = 0;
  for (const c of cands) {
    if (internalCount >= internalCap) break;
    if (usedSlugs.has(c.slug)) continue;
    const spans = protectedSpans(out);
    const ledeEnd = firstSentenceEnd(out);
    const idx = findInsertable(out, c.phrase, spans, ledeEnd);
    if (idx < 0) continue;
    const anchor = out.slice(idx, idx + c.phrase.length); // preserve original casing
    out = `${out.slice(0, idx)}[${anchor}](/blog/${c.slug})${out.slice(idx + c.phrase.length)}`;
    usedSlugs.add(c.slug);
    internalCount += 1;
  }

  // ---- Brand links -------------------------------------------------------
  let brandCount = 0;
  for (const brand of BRAND_REGISTRY) {
    if (brandCount >= 2) break;
    if (!brand.url) continue; // unlinked mention (e.g. Bokari) — leave as prose
    if (!brand.categories.includes(opts.category)) continue;
    if (!brand.trigger.test(out)) continue;
    const spans = protectedSpans(out);
    const ledeEnd = firstSentenceEnd(out);
    const idx = findInsertable(out, brand.name, spans, ledeEnd);
    if (idx < 0) continue; // name not present naturally → no shoehorned link
    const anchor = out.slice(idx, idx + brand.name.length);
    out = `${out.slice(0, idx)}[${anchor}](${brand.url})${out.slice(idx + brand.name.length)}`;
    brandCount += 1;
  }

  return out;
}

/**
 * Strip any link the MODEL emitted (it shouldn't, but guard): turn
 * `[text](http…)` / `[text](/path)` back into plain `text`, and remove bare
 * URLs. Citations `[n]` (no parens) are untouched. Run this BEFORE
 * injectBacklinks so only our deterministic, verified links survive.
 */
export function stripModelLinks(body: string): string {
  return body
    .replace(/\[([^\]]+)\]\((?:https?:\/\/|\/)[^)]*\)/g, '$1')
    .replace(/(?<![("])\bhttps?:\/\/[^\s)]+/g, '')
    .trim();
}
