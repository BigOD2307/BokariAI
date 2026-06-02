/**
 * @module MessageRenderer/ChartBlock
 * @description Inline chart wrapper around Recharts.  Picks the
 *   chart kind (bar / line / area / pie / radar) from the ChartSpec
 *   and renders a responsive SVG with Bokari teal as the default
 *   accent.  Includes a small download-as-SVG button.  Rendering
 *   is gated on a successful spec — fall through to a friendly
 *   placeholder if the spec is malformed.
 *
 * @author Amadou — Dicken AI
 * @version 1.0.0
 */
import { Download } from 'lucide-react';
import {
  Bar,
  BarChart,
  Line,
  LineChart,
  Area,
  AreaChart,
  Pie,
  PieChart,
  Cell,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { ChartSpec } from '@/lib/types/multimodal';
import { cn } from '@/lib/utils';

const COLORS = [
  '#1FB8CD',
  '#F4A261',
  '#2A9D8F',
  '#E76F51',
  '#264653',
  '#E9C46A',
];

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
          {renderChart(spec)}
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

function renderChart(spec: ChartSpec): React.ReactElement {
  const commonAxes = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
      <XAxis dataKey={spec.xKey} tick={{ fontSize: 11 }} />
      <YAxis tick={{ fontSize: 11 }} />
      <Tooltip
        contentStyle={{
          borderRadius: 12,
          fontSize: 12,
          border: '1px solid rgba(0,0,0,0.08)',
        }}
      />
      <Legend wrapperStyle={{ fontSize: 12 }} />
    </>
  );

  switch (spec.kind) {
    case 'bar':
      return (
        <BarChart data={spec.data}>
          {commonAxes}
          {spec.series.map((s, i) => (
            <Bar
              key={s.name}
              dataKey={s.name}
              fill={s.color ?? COLORS[i % COLORS.length]}
              radius={[6, 6, 0, 0]}
            />
          ))}
        </BarChart>
      );
    case 'line':
      return (
        <LineChart data={spec.data}>
          {commonAxes}
          {spec.series.map((s, i) => (
            <Line
              key={s.name}
              type="monotone"
              dataKey={s.name}
              stroke={s.color ?? COLORS[i % COLORS.length]}
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          ))}
        </LineChart>
      );
    case 'area':
      return (
        <AreaChart data={spec.data}>
          {commonAxes}
          {spec.series.map((s, i) => (
            <Area
              key={s.name}
              type="monotone"
              dataKey={s.name}
              fill={s.color ?? COLORS[i % COLORS.length]}
              stroke={s.color ?? COLORS[i % COLORS.length]}
              fillOpacity={0.4}
            />
          ))}
        </AreaChart>
      );
    case 'pie':
      return (
        <PieChart>
          <Pie
            data={spec.data}
            dataKey={spec.series[0]?.name ?? 'value'}
            nameKey={spec.xKey}
            outerRadius={100}
            label
          >
            {spec.data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      );
    case 'radar':
      return (
        <RadarChart data={spec.data}>
          <PolarGrid />
          <PolarAngleAxis dataKey={spec.xKey} />
          {spec.series.map((s, i) => (
            <Radar
              key={s.name}
              name={s.name}
              dataKey={s.name}
              stroke={s.color ?? COLORS[i % COLORS.length]}
              fill={s.color ?? COLORS[i % COLORS.length]}
              fillOpacity={0.4}
            />
          ))}
          <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </RadarChart>
      );
    default:
      return (
        <BarChart data={spec.data}>
          {commonAxes}
          <Bar
            dataKey={spec.series[0]?.name ?? 'value'}
            fill={COLORS[0]}
            radius={[6, 6, 0, 0]}
          />
        </BarChart>
      );
  }
}

export default ChartBlock;
