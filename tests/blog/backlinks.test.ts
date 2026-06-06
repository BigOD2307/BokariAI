import { describe, it, expect, beforeAll } from 'vitest';
import { injectBacklinks, stripModelLinks } from '@/lib/blog/backlinks';
import { insertArticle } from '@/lib/blog/store';

// tests/setup.ts points DATA_DIR at a per-run tmpdir, so the SQLite articles
// table is real but isolated — no network, no shared state.

describe('blog/backlinks', () => {
  beforeAll(async () => {
    await insertArticle({
      title: 'Mobile money : Wave bouscule le marché sénégalais',
      excerpt: 'Décryptage.',
      body: 'Corps.',
      category: 'business',
      status: 'published',
      origin: 'seed',
      sources: [],
    });
  });

  it('inserts an internal link only on a verbatim title-phrase match', async () => {
    const body =
      "Le secteur bancaire change vite. En quelques mois, Wave bouscule le marché et impose des frais plus bas aux concurrents, qui doivent s'aligner.";
    const out = await injectBacklinks(body, { category: 'business' });
    expect(out).toMatch(/\[[^\]]*Wave bouscule le marché[^\]]*\]\(\/blog\/[a-z0-9-]+\)/);
  });

  it('does NOT link when the body is unrelated to any published article', async () => {
    const body =
      "La sélection nationale a remporté un match amical hier soir. Les supporters ont envahi les rues de la capitale pour fêter cette victoire méritée.";
    const out = await injectBacklinks(body, { category: 'sport' });
    expect(out).not.toContain('/blog/');
  });

  it('adds a brand link only when category + trigger + name all match', async () => {
    const body =
      "Le chômage des jeunes reste élevé. Des plateformes comme ZeroName aident les diplômés à trouver un emploi grâce au matching de CV et aux offres ciblées.";
    const out = await injectBacklinks(body, { category: 'business' });
    expect(out).toContain('[ZeroName](https://zeroname.space)');
  });

  it('does NOT add a brand link when the brand name is absent from the prose', async () => {
    const body =
      "Le chômage des jeunes reste un défi majeur. Le marché de l'emploi peine à absorber les diplômés malgré les offres de recrutement.";
    const out = await injectBacklinks(body, { category: 'business' });
    expect(out).not.toContain('zeroname.space');
  });

  it('is idempotent — re-running does not double-wrap links', async () => {
    const body =
      "Analyse du secteur. Sur le terrain, Wave bouscule le marché et redéfinit les usages du paiement mobile au Sénégal.";
    const once = await injectBacklinks(body, { category: 'business' });
    const twice = await injectBacklinks(once, { category: 'business' });
    const count = (s: string) => (s.match(/\]\(\/blog\//g) || []).length;
    expect(count(twice)).toBe(count(once));
    expect(twice).not.toMatch(/\]\(\/blog\/[^)]*\)\]/); // no nested wrapping
  });

  it('stripModelLinks removes model-authored links/URLs but keeps [n] citations', () => {
    const input =
      'Selon le rapport [1], voir [ce lien](https://evil.example/x) et aussi https://spam.example pour plus [2].';
    const out = stripModelLinks(input);
    expect(out).toContain('[1]');
    expect(out).toContain('[2]');
    expect(out).toContain('ce lien');
    expect(out).not.toContain('evil.example');
    expect(out).not.toContain('spam.example');
  });
});
