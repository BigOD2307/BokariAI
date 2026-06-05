/**
 * @module MessageRenderer/VerdictBlock
 * @description Fact-check verdict block — Bokari's category-defining trust
 *   component. A colored badge per verdict (vrai=green, faux=red,
 *   trompeur=amber, non_verifie=neutral), the claim, a one-line justification,
 *   and a confidence bar. Sits at the top of the rich-block stack.
 */
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  HelpCircle,
  type LucideIcon,
} from 'lucide-react';
import type { VerdictSpec, VerdictLabel } from '@/lib/types/multimodal';
import { cn } from '@/lib/utils';

const TONE: Record<
  VerdictLabel,
  { badge: string; bar: string; Icon: LucideIcon }
> = {
  vrai: {
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    bar: 'bg-emerald-500',
    Icon: CheckCircle2,
  },
  faux: {
    badge: 'bg-rose-50 text-rose-700 border-rose-200',
    bar: 'bg-rose-500',
    Icon: XCircle,
  },
  trompeur: {
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
    bar: 'bg-amber-500',
    Icon: AlertTriangle,
  },
  non_verifie: {
    badge:
      'bg-black/[0.04] text-black/55 border-black/10 dark:bg-white/[0.06] dark:text-white/55 dark:border-white/10',
    bar: 'bg-black/30 dark:bg-white/30',
    Icon: HelpCircle,
  },
};

const VerdictBlock: React.FC<{ spec: VerdictSpec }> = ({ spec }) => {
  const tone = TONE[spec.verdict] ?? TONE.non_verifie;
  const Icon = tone.Icon;
  const pct = Math.max(0, Math.min(100, Math.round((spec.confidence ?? 0) * 100)));

  return (
    <div className="my-3 rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-dark-200 p-4">
      <div className="flex items-center gap-2 mb-2">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold',
            tone.badge,
          )}
        >
          <Icon size={14} />
          {spec.verdictLabel}
        </span>
        <span className="text-[11px] text-black/40 dark:text-white/35">
          Vérification Bokari
        </span>
      </div>
      <p className="text-sm font-medium text-black/85 dark:text-white/80">
        {spec.claim}
      </p>
      {spec.summary && (
        <p className="mt-1.5 text-sm text-black/60 dark:text-white/55 leading-snug">
          {spec.summary}
        </p>
      )}
      <div className="mt-3 flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-black/[0.06] dark:bg-white/[0.08] overflow-hidden">
          <div
            className={cn('h-full rounded-full', tone.bar)}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-[11px] text-black/40 dark:text-white/35 flex-shrink-0">
          confiance {pct}%
        </span>
      </div>
    </div>
  );
};

export default VerdictBlock;
