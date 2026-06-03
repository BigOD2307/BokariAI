/**
 * @module MessageRenderer/chartVariants
 * @description Internal chart-renderer variants for ChartBlock.  Kept in
 *   a separate file so the public ChartBlock component stays under
 *   the 200-line ceiling.  Each variant returns a Recharts element.
 */
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
} from 'recharts';
import type { ChartSpec } from '@/lib/types/multimodal';

export const CHART_COLORS = [
  '#1FB8CD',
  '#F4A261',
  '#2A9D8F',
  '#E76F51',
  '#264653',
  '#E9C46A',
];

const TOOLTIP_STYLE = { borderRadius: 12, fontSize: 12, border: '1px solid rgba(0,0,0,0.08)' };
const LEGEND_STYLE = { fontSize: 12 };

export function renderChartVariant(spec: ChartSpec): React.ReactElement {
  const axes = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
      <XAxis dataKey={spec.xKey} tick={{ fontSize: 11 }} />
      <YAxis tick={{ fontSize: 11 }} />
      <Tooltip contentStyle={TOOLTIP_STYLE} />
      <Legend wrapperStyle={LEGEND_STYLE} />
    </>
  );

  switch (spec.kind) {
    case 'bar':
      return (
        <BarChart data={spec.data}>
          {axes}
          {spec.series.map((s, i) => (
            <Bar
              key={s.name}
              dataKey={s.name}
              fill={s.color ?? CHART_COLORS[i % CHART_COLORS.length]}
              radius={[6, 6, 0, 0]}
            />
          ))}
        </BarChart>
      );
    case 'line':
      return (
        <LineChart data={spec.data}>
          {axes}
          {spec.series.map((s, i) => (
            <Line
              key={s.name}
              type="monotone"
              dataKey={s.name}
              stroke={s.color ?? CHART_COLORS[i % CHART_COLORS.length]}
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          ))}
        </LineChart>
      );
    case 'area':
      return (
        <AreaChart data={spec.data}>
          {axes}
          {spec.series.map((s, i) => (
            <Area
              key={s.name}
              type="monotone"
              dataKey={s.name}
              fill={s.color ?? CHART_COLORS[i % CHART_COLORS.length]}
              stroke={s.color ?? CHART_COLORS[i % CHART_COLORS.length]}
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
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Legend wrapperStyle={LEGEND_STYLE} />
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
              stroke={s.color ?? CHART_COLORS[i % CHART_COLORS.length]}
              fill={s.color ?? CHART_COLORS[i % CHART_COLORS.length]}
              fillOpacity={0.4}
            />
          ))}
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Legend wrapperStyle={LEGEND_STYLE} />
        </RadarChart>
      );
    default:
      return (
        <BarChart data={spec.data}>
          {axes}
          <Bar
            dataKey={spec.series[0]?.name ?? 'value'}
            fill={CHART_COLORS[0]}
            radius={[6, 6, 0, 0]}
          />
        </BarChart>
      );
  }
}
