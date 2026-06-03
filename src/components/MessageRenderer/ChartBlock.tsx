/**
 * @module MessageRenderer/ChartBlock
 * @description Inline chart wrapper around Recharts.  Picks the
 *   chart kind (bar / line / area / pie / radar) from the ChartSpec
 *   and renders a responsive SVG with Bokari teal as the default
 *   accent.  Includes a small download-as-SVG button.
 *
 * @author Amadou — Dicken AI
 * @version 1.0.0
 */
import { Download } from 'lucide-react';
import { ResponsiveContainer } from 'recharts';
import type { ChartSpec } from '@/lib/types/multimodal';
import { cn } from '@/lib/utils';
import { renderChartVariant } from './chartVariants';

interface Props {
  spec: ChartSpec;
}

const ChartBlock: React.FC<Props> = ({ spec }) => {
  const downloadSvg = () => {
    if (typeof document === 'undefined') return;
    const svg = document.querySelector(
      `#chart-${spec.id} svg`,
    ) as SVGElement | null;
    if (!svg) return;
    const xml = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([xml], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${spec.title.replace(/\s+/g, '_')}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      id={`chart-${spec.id}`}
      className={cn(
        'my-3 p-4 rounded-xl',
        'bg-white dark:bg-dark-200',
        'border border-black/[0.08] dark:border-white/[0.08]',
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold text-black/90 dark:text-white/90 truncate pr-2">
          {spec.title}
        </h4>
        <button
          type="button"
          onClick={downloadSvg}
          title={'T\u00e9l\u00e9charger (SVG)'}
          aria-label={'T\u00e9l\u00e9charger le graphique'}
          className={cn(
            'p-1 rounded flex-shrink-0',
            'text-bokari-500 hover:bg-bokari-500/10',
            'transition-colors duration-150',
          )}
        >
          <Download className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="w-full h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          {renderChartVariant(spec)}
        </ResponsiveContainer>
      </div>
      {(spec.caption || spec.unit) && (
        <p className="text-xs text-black/50 dark:text-white/45 mt-2">
          {spec.caption ?? ''}
          {spec.unit ? (spec.caption ? ` (${spec.unit})` : spec.unit) : ''}
        </p>
      )}
    </div>
  );
};

export default ChartBlock;
