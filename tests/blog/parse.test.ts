import { describe, it, expect } from 'vitest';
import { parseArticle } from '@/lib/blog/generate';

describe('blog/generate parseArticle', () => {
  it('extracts title + Markdown body from the unquoted-body malformation', () => {
    // The exact shape models emit: quoted title/excerpt, then a raw Markdown
    // body with literal newlines (invalid JSON).
    const raw =
      '{"title": "La tech africaine en 2026 : une année de croissance", \n' +
      '"excerpt": "Les startups africaines ont levé 3,1 milliards USD [5].", \n' +
      '"body": \n## Un secteur en plein essor\n' +
      "L'écosystème **tech** attire les investisseurs [1]. La croissance se confirme [2], " +
      'avec des levées de fonds record sur tout le continent et des perspectives solides pour 2026.\n}';
    const p = parseArticle(raw);
    expect(p).not.toBeNull();
    expect(p!.title).toBe('La tech africaine en 2026 : une année de croissance');
    expect(p!.excerpt).toContain('3,1 milliards');
    expect(p!.body).toContain('## Un secteur en plein essor');
    expect(p!.body).toContain('[1]');
    expect(p!.body).not.toContain('"body"');
    // The dangling JSON closing brace must be stripped from the body.
    expect((p!.body ?? '').trim().endsWith('}')).toBe(false);
  });

  it('parses well-formed strict JSON', () => {
    const raw = JSON.stringify({
      title: 'Titre correct et assez long',
      excerpt: 'Un chapô.',
      body: '## Section\nUn corps de plus de deux cents caractères, bien assez long pour passer le seuil minimal du parseur et contenir une citation [1] vérifiable.',
    });
    const p = parseArticle(raw);
    expect(p!.title).toBe('Titre correct et assez long');
    expect(p!.body).toContain('## Section');
  });

  it('returns null on empty / junk output', () => {
    expect(parseArticle('')).toBeNull();
    expect(parseArticle('désolé je ne peux pas')).toBeNull();
  });
});
