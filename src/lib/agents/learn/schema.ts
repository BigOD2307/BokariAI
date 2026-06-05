/**
 * @module agents/learn/schema
 * @description Zod schema matching the JSON contract of `learnBundlePrompt`
 *   (prompt.ts). Used to validate the structured LLM output in runLearnBundle.
 */
import { z } from 'zod';

const bloomLevel = z.enum(['remember', 'understand', 'apply']).optional();

export const learnFlashcardSchema = z.object({
  front: z.string().min(1),
  back: z.string().min(1),
  bloomLevel,
});

export const learnQuizQuestionSchema = z.object({
  question: z.string().min(1),
  options: z.array(z.string()).min(2),
  correctIndex: z.number().int().min(0),
  explanation: z.string(),
  bloomLevel,
});

export const learnBundleSchema = z
  .object({
    socraticReply: z.string().min(1),
    flashcards: z.array(learnFlashcardSchema).min(1),
    quiz: z.array(learnQuizQuestionSchema),
  })
  // A correctIndex must point at a real option.
  .refine(
    (b) => b.quiz.every((q) => q.correctIndex < q.options.length),
    { message: 'correctIndex out of range' },
  );

export type LearnBundle = z.infer<typeof learnBundleSchema>;
