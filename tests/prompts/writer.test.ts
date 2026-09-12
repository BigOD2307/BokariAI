import { describe, it, expect } from 'vitest';
import { getWriterPrompt } from '@/lib/prompts/search/writer';
import type { Evidence } from '@/lib/agents/search/evidence';

const emptyEvidence: Evidence = { sources: [], block: '' };

describe('writer prompt anti-slop', () => {
  for (const mode of ['speed', 'balanced', 'quality', 'eco'] as const) {
    it(`${mode}: bans hollow formulas and ordered conclusions`, () => {
      const prompt = getWriterPrompt(emptyEvidence, 'None', mode);
      expect(prompt).toContain('Anti-banalites');
      expect(prompt).toContain('En conclusion');
      expect(prompt).toContain('INTERDIT');
      // No mode instruction may still order a conclusion/synthesis sentence.
      expect(prompt).not.toContain('une phrase de conclusion');
      expect(prompt).not.toContain('Termine par une synthese');
    });
  }

  it('eco: ultra-short answer contract for slow connections', () => {
    const prompt = getWriterPrompt(emptyEvidence, 'None', 'eco');
    expect(prompt).toContain('80 et 150 mots');
    expect(prompt).toContain('PAS de sous-titres');
  });
});
