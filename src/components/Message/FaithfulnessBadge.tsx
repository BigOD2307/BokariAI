'use client';

import { useState } from 'react';
import { ShieldCheck, ShieldAlert, ShieldX, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  FaithfulnessReport,
  ClaimVerdict,
} from '@/lib/agents/search/faithfulness';

const LABEL_FR: Record<ClaimVerdict, string> = {
  supported: 'Soutenue',
  partial: 'Partielle',
  unsupported: 'Non soutenue',
};

/**
 * C8 — per-claim faithfulness badge with showable proof. Renders
 * "X/Y affirmations vérifiées" and expands to list every claim that is not
 * fully supported. A `supported` claim carries a verbatim quote from its
 * source — the reader checks the proof itself, not our badge.
 *
 * When `report.unavailable` is set the check could not run: we render nothing,
 * never a badge computed from missing data.
 */
export default function FaithfulnessBadge({
  report,
}: {
  report: FaithfulnessReport;
}) {
  const [open, setOpen] = useState(false);
  if (!report || report.unavailable || report.total === 0) return null;

  const allGood = report.unsupported === 0 && report.partial === 0;
  const hasFail = report.unsupported > 0;
  // More than a third of claims unsupported → warning tone even without a
  // hard fail, so a plausible-looking answer can't masquerade as verified.
  const mostlyUnsupported =
    report.unsupported / report.total > 1 / 3;

  const tone = hasFail || mostlyUnsupported
    ? 'text-rose-700 bg-rose-50 border-rose-200'
    : allGood
      ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
      : 'text-amber-700 bg-amber-50 border-amber-200';

  const Icon = hasFail ? ShieldX : allGood ? ShieldCheck : ShieldAlert;

  // Surface only claims that aren't fully supported — those are the ones a
  // reader should double-check.
  const flagged = report.claims.filter((c) => c.verdict !== 'supported');

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
          {flagged.map((claim, i) => (
            <li
              key={i}
              className="rounded-xl border border-black/[0.06] bg-white/60 px-3 py-2 text-xs"
            >
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                    claim.verdict === 'unsupported'
                      ? 'bg-rose-100 text-rose-700'
                      : 'bg-amber-100 text-amber-700',
                  )}
                >
                  {LABEL_FR[claim.verdict]}
                </span>
                <span className="text-black/40">
                  source {claim.sourceIds.join(', ')}
                </span>
              </div>
              <p className="mt-1 text-black/70">{claim.text}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
