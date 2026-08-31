import { describe, expect, it } from 'vitest';
import { selectPassages, splitIntoPassages } from '@/lib/retrieval/passages';

const page = (url: string, text: string) => ({
  url,
  title: null,
  text,
  publishedAt: null,
  author: null,
  bytes: 0,
});

describe('splitIntoPassages', () => {
  it('never splits mid-paragraph', () => {
    const text = ['a'.repeat(500), 'b'.repeat(500), 'c'.repeat(500)].join('\n\n');
    for (const passage of splitIntoPassages(text)) {
      expect(passage).not.toMatch(/^[ab]{1,50}$/); // no orphan fragments
    }
  });

  it('drops navigation-sized fragments', () => {
    expect(splitIntoPassages('Accueil\n\nContact\n\n' + 'x'.repeat(300))).toHaveLength(1);
  });

  it('keeps overlap context between consecutive passages', () => {
    const paragraphs = Array.from({ length: 5 }, (_, i) => `paragraphe ${i} `.repeat(60));
    const passages = splitIntoPassages(paragraphs.join('\n\n'));
    expect(passages.length).toBeGreaterThan(1);
  });
});

describe('selectPassages', () => {
  it('scores the passage that answers the question higher than an unrelated one', () => {
    // NOTE: same-page results come back in DOCUMENT order, not rank order
    // (see the function's own doc comment) — so this asserts on `.score`,
    // not on array position.
    const pages = [
      page(
        'https://a.test',
        [
          'Le climat du Sahel est semi-aride. '.repeat(20),
          "Le budget 2026 du Mali s'élève à 3 200 milliards de FCFA selon la loi de finances. ".repeat(6),
        ].join('\n\n'),
      ),
    ];
    const out = selectPassages(pages, ['budget 2026 Mali FCFA'], { maxPerPage: 3, maxTotal: 5 });
    const budgetPassage = out.find((p) => p.text.includes('budget 2026'))!;
    const climatePassage = out.find((p) => p.text.includes('climat du Sahel'))!;
    expect(budgetPassage).toBeDefined();
    expect(budgetPassage.score).toBeGreaterThan(climatePassage?.score ?? 0);
  });

  it('caps passages per page so one article cannot fill the window', () => {
    const long = Array.from({ length: 20 }, (_, i) => `budget mali ${i} `.repeat(30)).join('\n\n');
    const out = selectPassages([page('https://a.test', long)], ['budget mali'], {
      maxPerPage: 2,
      maxTotal: 10,
    });
    expect(out).toHaveLength(2);
  });

  it('respects maxTotal across multiple pages', () => {
    const pages = Array.from({ length: 5 }, (_, i) =>
      page(`https://a${i}.test`, `sujet mali ${i} `.repeat(40)),
    );
    const out = selectPassages(pages, ['sujet mali'], { maxPerPage: 3, maxTotal: 4 });
    expect(out).toHaveLength(4);
  });

  it('returns same-page passages in document order', () => {
    const text = Array.from({ length: 6 }, (_, i) => `mali budget section ${i} `.repeat(30)).join('\n\n');
    const out = selectPassages([page('https://a.test', text)], ['mali budget'], {
      maxPerPage: 4,
      maxTotal: 4,
    });
    expect(out.map((p) => p.index)).toEqual([...out.map((p) => p.index)].sort((a, b) => a - b));
  });

  it('returns an empty array for pages with no usable text', () => {
    expect(selectPassages([page('https://a.test', '')], ['x'], { maxPerPage: 3, maxTotal: 5 })).toEqual([]);
  });

  it('falls back to document order when scores do not discriminate (degenerate BM25 on a tiny corpus)', () => {
    // Each paragraph is long enough to pass the >40-char filter, and the two
    // combined exceed TARGET_CHARS (900), so they land in separate passages.
    const pages = [
      page(
        'https://a.test',
        [
          'Ceci est le tout premier paragraphe de cette page de test. '.repeat(15),
          'Et voici le second paragraphe, tout aussi long que le premier. '.repeat(15),
        ].join('\n\n'),
      ),
    ];
    const out = selectPassages(pages, ['un mot qui napparait nulle part ailleurs'], {
      maxPerPage: 5,
      maxTotal: 5,
    });
    expect(out.map((p) => p.index)).toEqual([0, 1]);
  });
});
