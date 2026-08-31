import { describe, expect, it } from 'vitest';
import { auditCitations } from '@/lib/agents/search/citations';
import type { EvidenceSource } from '@/lib/agents/search/evidence';

const sources: EvidenceSource[] = [
  { id: 'S1', url: 'https://a.test/1', title: 'A', domain: 'a.test', publishedAt: null, passages: ['x'] },
  { id: 'S2', url: 'https://b.test/1', title: 'B', domain: 'b.test', publishedAt: null, passages: ['y'] },
];

describe('auditCitations', () => {
  it('removes references the model invented (BUG-21)', () => {
    const out = auditCitations('Le budget est de 3 200 milliards [S9].', sources);
    expect(out.text).not.toContain('S9');
    expect(out.invented).toEqual(['S9']);
  });

  it('lists cited sources in order of first appearance, without duplicates', () => {
    const out = auditCitations('Un fait [S2]. Un autre [S1]. Encore [S2].', sources);
    expect(out.cited.map((s) => s.id)).toEqual(['S2', 'S1']);
  });

  it('flags factual sentences that carry no citation', () => {
    const out = auditCitations(
      'Le budget 2026 atteint 3 200 milliards de FCFA. Cette hausse est notable [S1].',
      sources,
    );
    expect(out.unsourcedClaims).toHaveLength(1);
    expect(out.unsourcedClaims[0]).toContain('3 200 milliards');
  });

  it('leaves an answer with no citations alone', () => {
    const out = auditCitations("Je n'ai trouvé aucune source fiable sur ce sujet.", []);
    expect(out.text).toBe("Je n'ai trouvé aucune source fiable sur ce sujet.");
    expect(out.cited).toEqual([]);
  });

  it('keeps a valid reference intact', () => {
    const out = auditCitations('Le PIB a crû de 3,4% [S1].', sources);
    expect(out.text).toContain('[S1]');
    expect(out.invented).toEqual([]);
  });
});
