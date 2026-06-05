import { describe, it, expect } from 'vitest';
import { learnBundleSchema } from '@/lib/agents/learn/schema';
import { parseJsonLoose, runLearnBundle } from '@/lib/agents/learn/runLearnBundle';
import type { LlmCallable } from '@/lib/agents/multimodal/charts';

const VALID = {
  socraticReply: 'Et toi, que se passe-t-il quand une plante reçoit de la lumière ?',
  flashcards: [
    { front: 'Photosynthèse ?', back: 'Conversion de la lumière en énergie.', bloomLevel: 'understand' },
    { front: 'Où ?', back: 'Dans les chloroplastes.' },
  ],
  quiz: [
    {
      question: 'Que produit la photosynthèse ?',
      options: ['Oxygène', 'Azote', 'Hélium'],
      correctIndex: 0,
      explanation: "La photosynthèse libère de l'oxygène.",
      bloomLevel: 'remember',
    },
  ],
};

const llmReturning = (content: string): LlmCallable => ({
  call: async () => ({ content }),
});

describe('learn/schema — validation', () => {
  it('accepts a well-formed bundle', () => {
    expect(learnBundleSchema.safeParse(VALID).success).toBe(true);
  });

  it('rejects a correctIndex out of range', () => {
    const bad = { ...VALID, quiz: [{ ...VALID.quiz[0], correctIndex: 9 }] };
    expect(learnBundleSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects an empty flashcards array', () => {
    expect(learnBundleSchema.safeParse({ ...VALID, flashcards: [] }).success).toBe(false);
  });
});

describe('learn/runLearnBundle — parsing', () => {
  it('parses JSON wrapped in markdown fences', () => {
    const fenced = '```json\n' + JSON.stringify(VALID) + '\n```';
    expect(parseJsonLoose(fenced)).not.toBeNull();
  });

  it('returns null on unparseable text', () => {
    expect(parseJsonLoose('totally not json')).toBeNull();
  });

  it('returns the validated bundle from a mocked LLM', async () => {
    const out = await runLearnBundle('photosynthèse', 'sources...', llmReturning(JSON.stringify(VALID)));
    expect(out).not.toBeNull();
    expect(out!.flashcards).toHaveLength(2);
    expect(out!.quiz[0]!.correctIndex).toBe(0);
  });

  it('returns null when the LLM output fails validation', async () => {
    const out = await runLearnBundle('x', 'y', llmReturning('{"socraticReply":"hi"}'));
    expect(out).toBeNull();
  });

  it('returns null when the LLM throws', async () => {
    const throwing: LlmCallable = {
      call: async () => {
        throw new Error('down');
      },
    };
    expect(await runLearnBundle('x', 'y', throwing)).toBeNull();
  });
});
