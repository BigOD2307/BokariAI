/**
 * Autonomous article generator.
 *
 * Given a category, Bokari searches the live web for that beat, then writes a
 * sourced, French, journalistic article. Citations are bound to the URLs we
 * actually fetched — the model only chooses *which* numbered source to cite, it
 * never invents URLs — so every [n] in the body resolves to a real link.
 *
 * Output is saved as a `draft` (origin `auto`). A human approves it in the
 * review queue before it goes public (human-in-the-loop). See ./store.
 */
import { parse as parsePartial, Allow } from 'partial-json';
import type { Message } from '@/lib/types';
import { chatWithFallback } from '@/lib/ai/gateway';
import { searchNews } from '@/lib/search';
import { getCategory } from './categories';
import { insertArticle, type StoredArticle } from './store';
import type { ArticleSource } from './articles';

type FetchedSource = { title: string; outlet: string; url: string; snippet: string };

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'source';
  }
}

/** Pull fresh results across the category's seed queries, dedupe by URL. */
async function gatherSources(seeds: string[], limit = 8): Promise<FetchedSource[]> {
  const settled = await Promise.allSettled(seeds.map((q) => searchNews(q)));
  const seen = new Set<string>();
  const out: FetchedSource[] = [];
  for (const r of settled) {
    if (r.status !== 'fulfilled') continue;
    for (const res of r.value) {
      if (!res.url || seen.has(res.url)) continue;
      const snippet = (res.content ?? '').trim();
      if (!res.title || snippet.length < 40) continue; // skip thin results
      seen.add(res.url);
      out.push({
        title: res.title.trim(),
        outlet: hostnameOf(res.url),
        url: res.url,
        snippet: snippet.slice(0, 600),
      });
      if (out.length >= limit) return out;
    }
  }
  return out;
}

function buildPrompt(
  categoryLabel: string,
  sources: FetchedSource[],
): Message[] {
  const numbered = sources
    .map((s, i) => `[${i + 1}] ${s.title} — ${s.outlet}\n${s.snippet}`)
    .join('\n\n');

  const system = `Tu es Bokari, le journaliste IA africain de Dicken AI. Tu écris des articles d'actualité en FRANÇAIS, rigoureux, accessibles et sourcés, avec un point de vue africain.

Règles ABSOLUES :
- Écris uniquement à partir des extraits web fournis ci-dessous. N'invente AUCUN fait, chiffre, citation, ni source.
- Cite tes affirmations avec des appels de note numériques [n] qui correspondent EXACTEMENT aux numéros des sources fournies. N'utilise jamais un numéro qui n'existe pas dans la liste.
- Écris l'article même si les sources sont limitées : reste factuel et n'extrapole pas au-delà des extraits.
- Ton sobre et factuel, pas de sensationnalisme. Recoupe quand plusieurs sources se contredisent.
- Le corps est en Markdown : 600 à 1100 mots, avec 2 à 4 sous-titres "## ...". Mets en gras les faits clés.

Réponds STRICTEMENT en JSON valide, sans texte autour, sans bloc de code, avec ce schéma :
{"title": string, "excerpt": string (une phrase, ~160 caractères max), "body": string (Markdown avec des [n])}`;

  const user = `Rubrique : ${categoryLabel}.

Sources web (numérotées — cite-les avec [n]) :

${numbered}

Rédige l'article maintenant. JSON uniquement.`;

  return [
    { role: 'system', content: system } as Message,
    { role: 'user', content: user } as Message,
  ];
}

type ParsedArticle = { title?: string; excerpt?: string; body?: string };

/**
 * Best-effort extraction of the article from the model output. Tries, in order:
 * strict JSON, partial-JSON recovery (handles truncation at the token cap), and
 * a Markdown fallback (when the model ignores the JSON instruction and just
 * writes the article). Robust to the smaller/verbose models in the fallback
 * chain.
 */
function parseArticle(raw: string): ParsedArticle | null {
  let txt = raw.trim();
  const fenced = txt.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) txt = fenced[1];
  const start = txt.indexOf('{');
  const end = txt.lastIndexOf('}');
  const jsonish = start >= 0 ? txt.slice(start, end > start ? end + 1 : undefined) : txt;

  // 1. strict JSON
  try {
    const o = JSON.parse(jsonish);
    if (o && (o.title || o.body)) return o;
  } catch {
    /* fall through */
  }
  // 2. partial / repaired JSON (recovers a body truncated at the token cap)
  try {
    const o = parsePartial(jsonish, Allow.ALL) as ParsedArticle;
    if (o && (o.title || o.body)) return o;
  } catch {
    /* fall through */
  }
  // 3. Markdown fallback — the model wrote prose instead of JSON
  const md = (fenced ? fenced[1] : raw).trim();
  if (md.length > 300) {
    const lines = md.split('\n');
    let title = '';
    const bodyLines: string[] = [];
    for (const line of lines) {
      const h = line.match(/^#{1,2}\s+(.*)/);
      if (!title && h) {
        title = h[1].trim();
        continue;
      }
      bodyLines.push(line);
    }
    if (!title) {
      const firstText = lines.find((l) => l.trim().length > 12);
      if (firstText) title = firstText.replace(/^#+\s*/, '').trim();
    }
    const body = bodyLines.join('\n').trim() || md;
    if (title && body.length > 300) return { title, body };
  }
  return null;
}

/**
 * Keep only the sources the body actually cites, and renumber them 1..k so the
 * "Sources" block is tight and the [n] stay consistent.
 */
function pruneAndRenumber(
  body: string,
  sources: FetchedSource[],
): { body: string; sources: ArticleSource[] } {
  const used: number[] = [];
  const re = /\[(\d+)\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    const n = Number(m[1]);
    if (n >= 1 && n <= sources.length && !used.includes(n)) used.push(n);
  }
  // Map old number -> new sequential number.
  const remap = new Map<number, number>();
  used.forEach((oldN, idx) => remap.set(oldN, idx + 1));
  const newBody = body.replace(/\[(\d+)\]/g, (full, d) => {
    const mapped = remap.get(Number(d));
    return mapped ? `[${mapped}]` : full;
  });
  const newSources: ArticleSource[] = used.map((oldN, idx) => {
    const s = sources[oldN - 1];
    return { id: idx + 1, title: s.title, outlet: s.outlet, url: s.url };
  });
  return { body: newBody, sources: newSources };
}

export type GenerateResult =
  | { ok: true; article: StoredArticle }
  | { ok: false; reason: string };

/**
 * Generate one draft article for a category. Returns the stored draft, or a
 * reason it was skipped (no sources / model abandoned / unusable output).
 */
export async function generateArticleForCategory(
  categorySlug: string,
): Promise<GenerateResult> {
  const cat = getCategory(categorySlug);
  if (!cat) return { ok: false, reason: `unknown category ${categorySlug}` };

  const sources = await gatherSources(cat.searchSeeds);
  if (sources.length < 2) {
    return { ok: false, reason: `not enough sources (${sources.length})` };
  }

  const messages = buildPrompt(cat.label, sources);
  let content = '';
  try {
    const res = await chatWithFallback(
      (model) =>
        model.generateText({
          messages,
          options: { temperature: 0.5, maxTokens: 3800 },
        }),
      `article:${categorySlug}`,
    );
    content = res.content ?? '';
  } catch (err) {
    return { ok: false, reason: `llm error: ${(err as Error)?.message ?? err}` };
  }

  const parsed = parseArticle(content);
  if (!parsed || !parsed.title || !parsed.body) {
    return { ok: false, reason: 'model abandoned or unparseable output' };
  }

  const title = parsed.title.trim();
  const bodyRaw = parsed.body.trim();
  if (title.length < 8 || bodyRaw.length < 300) {
    return { ok: false, reason: 'output too short' };
  }

  const { body, sources: finalSources } = pruneAndRenumber(bodyRaw, sources);
  if (finalSources.length === 0) {
    return { ok: false, reason: 'article cited no sources' };
  }

  const excerpt =
    (parsed.excerpt?.trim() || bodyRaw.replace(/[#*`>]/g, '').split('\n')[0] || '').slice(0, 200);

  const article = await insertArticle({
    category: categorySlug,
    title,
    excerpt,
    body,
    sources: finalSources,
    status: 'draft',
    origin: 'auto',
    author: 'Bokari',
  });

  return { ok: true, article };
}
