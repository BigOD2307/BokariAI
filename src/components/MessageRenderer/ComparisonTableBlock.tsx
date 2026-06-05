/**
 * @module MessageRenderer/ComparisonTableBlock
 * @description Renders a ComparisonTableSpec as a styled, horizontally
 *   scrollable table (base-nova tokens, bokari-500 accent on the highlighted
 *   column). Degrades gracefully on ragged rows.
 */
import type { ComparisonTableSpec } from '@/lib/types/multimodal';
import { cn } from '@/lib/utils';

const ComparisonTableBlock: React.FC<{ spec: ComparisonTableSpec }> = ({
  spec,
}) => {
  if (!spec.columns?.length || !spec.rows?.length) return null;

  return (
    <div className="my-3 rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-dark-200 overflow-hidden">
      {spec.title && (
        <div className="px-4 py-2.5 border-b border-black/[0.06] dark:border-white/[0.06]">
          <h4 className="text-sm font-semibold text-black/90 dark:text-white/90">
            {spec.title}
          </h4>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/[0.06] dark:border-white/[0.06]">
              {spec.columns.map((col, c) => (
                <th
                  key={c}
                  className={cn(
                    'px-3 py-2 text-left font-medium text-black/55 dark:text-white/50',
                    spec.highlightCol === c &&
                      'text-bokari-600 dark:text-bokari-400',
                  )}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {spec.rows.map((row, r) => (
              <tr
                key={r}
                className="border-b border-black/[0.04] dark:border-white/[0.04] last:border-0"
              >
                {spec.columns.map((_, c) => (
                  <td
                    key={c}
                    className={cn(
                      'px-3 py-2 align-top',
                      c === 0
                        ? 'font-medium text-black/80 dark:text-white/75'
                        : 'text-black/70 dark:text-white/60',
                      spec.highlightCol === c &&
                        'bg-bokari-500/[0.06] text-bokari-700 dark:text-bokari-300',
                    )}
                  >
                    {row[c] ?? ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ComparisonTableBlock;
