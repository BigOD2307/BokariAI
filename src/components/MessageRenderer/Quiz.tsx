'use client';

import { useState } from 'react';
import { Check, X } from 'lucide-react';
import type { QuizQuestion } from '@/lib/types';
import { cn } from '@/lib/utils';

/**
 * Quiz — multiple-choice questions with reveal-on-select: picking an option
 * locks the question, marks the correct answer green / a wrong pick red, and
 * shows the explanation. Running score once all are answered. Always carries
 * the trust footer (Bokari is a study aid, not a teacher).
 */
const Quiz = ({ questions }: { questions: QuizQuestion[] }) => {
  const [answers, setAnswers] = useState<Record<number, number>>({});

  if (!questions || questions.length === 0) return null;
  const answeredCount = Object.keys(answers).length;
  const score = questions.reduce(
    (acc, q, qi) => acc + (answers[qi] === q.correctIndex ? 1 : 0),
    0,
  );
  const done = answeredCount === questions.length;

  return (
    <div className="my-4 rounded-xl border-2 border-[color:var(--bk-ink,#0f172a)] bg-white p-4 shadow-[0_3px_0_rgba(15,23,42,0.08)]">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="font-hand text-[14px] uppercase tracking-wide text-[color:var(--bk-teal-700,#0f766e)]">
          Quiz
        </h4>
        {done && (
          <span className="rounded-full bg-[color:var(--bk-mint,#c8f4e0)]/50 px-2.5 py-0.5 text-[12px] font-semibold text-[color:var(--bk-teal-700,#0f766e)]">
            {score} / {questions.length}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-4">
        {questions.map((q, qi) => {
          const chosen = answers[qi];
          const locked = chosen !== undefined;
          return (
            <div key={qi}>
              <p className="mb-2 text-[14px] font-medium text-[color:var(--bk-ink,#0f172a)]">
                {qi + 1}. {q.question}
              </p>
              <div className="flex flex-col gap-1.5">
                {q.options.map((opt, oi) => {
                  const isCorrect = oi === q.correctIndex;
                  const isChosen = chosen === oi;
                  return (
                    <button
                      key={oi}
                      type="button"
                      disabled={locked}
                      onClick={() =>
                        setAnswers((a) => ({ ...a, [qi]: oi }))
                      }
                      className={cn(
                        'flex items-center justify-between gap-2 rounded-[10px] border-2 px-3 py-2 text-left text-[14px] transition-colors',
                        !locked &&
                          'border-[color:var(--bk-ink,#0f172a)]/12 hover:border-[color:var(--bk-ink,#0f172a)]/30',
                        locked && isCorrect && 'border-emerald-300 bg-emerald-50 text-emerald-800',
                        locked && isChosen && !isCorrect && 'border-rose-300 bg-rose-50 text-rose-800',
                        locked && !isCorrect && !isChosen && 'border-black/[0.06] text-black/45',
                      )}
                    >
                      <span>{opt}</span>
                      {locked && isCorrect && <Check size={15} className="flex-shrink-0" />}
                      {locked && isChosen && !isCorrect && <X size={15} className="flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
              {locked && q.explanation && (
                <p className="mt-2 rounded-[10px] bg-black/[0.03] px-3 py-2 text-[13px] leading-snug text-black/65">
                  {q.explanation}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-4 border-t border-black/[0.06] pt-3 text-[12px] text-black/40">
        ⚠️ Bokari t&apos;aide à réviser — vérifie toujours avec ton cours ou ton prof.
      </p>
    </div>
  );
};

export default Quiz;
