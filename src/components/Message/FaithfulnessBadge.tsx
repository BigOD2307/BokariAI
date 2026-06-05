'use client';

import { useState } from 'react';
import { ShieldCheck, ShieldAlert, ShieldX, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  FaithfulnessReport,
  ClaimLabel,
} from '@/lib/agents/search/faithfulness';

const LABEL_FR: Record<ClaimLabel, string> = {
  supported: 'Soutenue',
  partial: 'Partielle',
  unsupported: 'Non soutenue',
};

/**
 * Compact trust badge for the citation faithfulness gate (NLI). Renders
 * "X/Y affirmations vérifiées" and expands to list the claims that aren't fully
 * supported — Bokari's "chaque affirmation vérifiée à sa source" made visible.
 */
export default function FaithfulnessBadge({
  report,
}: {
  report: FaithfulnessReport;
}) {
  const [open, setOpen] = useState(false);
  if (!report || report.total === 0) return null;

  const allGood = report.unsupported === 0 && report.partial === 0;
  const hasFail = report.unsupported > 0;

  const tone = hasFail
    ? 'text-rose-700 bg-rose-50 border-rose-200'
    : allGood
      ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
      : 'text-amber-700 bg-amber-50 border-amber-200';

  const Icon = hasFail ? ShieldX : allGood ? ShieldCheck : ShieldAlert;

  // Surface only claims that aren't fully supported — those are the ones a
  // reader should double-check.
  const flagged = report.verdicts.filter((v) => v.label !== 'supported');

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={flagged.length === 0}
        className={cn(
          'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
          tone,
          flagged.length === 0 && 'cursor-default',
        )}
        title="Fidélité des citations — chaque affirmation vérifiée à sa source"
      >
        <Icon size={14} />
        <span>
          {report.supported}/{report.total} affirmations vérifiées
        </span>
        {flagged.length > 0 && (
          <ChevronDown
            size={13}
            className={cn('transition-transform', open && 'rotate-180')}
          />
        )}
      </button>

      {open && flagged.length > 0 && (
        <ul className="mt-2 flex flex-col gap-2">
          {flagged.map((v, i) => (
            <li
              key={i}
              className="rounded-xl border border-black/[0.06] bg-white/60 px-3 py-2 text-xs"
            >
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                    v.label === 'unsupported'
                      ? 'bg-rose-100 text-rose-700'
                      : 'bg-amber-100 text-amber-700',
                  )}
                >
                  {LABEL_FR[v.label]}
                </span>
                <span className="text-black/40">
                  source {v.citations.join(', ')}
                </span>
              </div>
              <p className="mt-1 text-black/70">{v.text}</p>
              {v.reason && (
                <p className="mt-0.5 italic text-black/40">{v.reason}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
