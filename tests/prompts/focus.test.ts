import { describe, it, expect } from 'vitest';
import {
  applyFocusToClassification,
  focusDirective,
} from '@/lib/prompts/search/focus';
import { getResearcherPrompt } from '@/lib/prompts/search/researcher';
import { defaultClassification } from '@/lib/agents/search/classifier';

describe('focus', () => {
  it('auto adds no directive to the researcher prompt', () => {
    const prompt = getResearcherPrompt('tools', 'speed', 0, 3, [], 'auto');
    expect(prompt).not.toContain('<focus>');
  });

  it('each focus briefs the researcher in the prompt', () => {
    for (const focus of ['actu', 'marches', 'demarches', 'examens'] as const) {
      const prompt = getResearcherPrompt('tools', 'speed', 0, 3, [], focus);
      expect(prompt).toContain('<focus>');
      expect(prompt).toContain('FOCUS');
    }
  });

  it('actu forces the fresh-news path, others leave classification untouched', () => {
    const base = defaultClassification('q');
    expect(base.classification.newsSearch).toBe(false);
    const actu = applyFocusToClassification(base, 'actu');
    expect(actu.classification.newsSearch).toBe(true);
    // Pure: the input is not mutated.
    expect(base.classification.newsSearch).toBe(false);
    for (const focus of ['auto', 'marches', 'demarches', 'examens'] as const) {
      expect(
        applyFocusToClassification(base, focus).classification.newsSearch,
      ).toBe(false);
    }
  });
});
