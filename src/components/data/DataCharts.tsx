'use client';

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  AreaChart,
  Area,
  LineChart,
  Line,
  PieChart,
  Pie,
} from 'recharts';

/* Canvas palette — fills only; text uses teal-700 for contrast. */
const TEAL = '#14b8a6';
const SAND = '#d4b483';
const INK = '#0f172a';
const INK_SOFT = '#334155';
const GRID = 'rgba(15,23,42,0.06)';

const reduceMotion =
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const animate = !reduceMotion;

function CanvasTooltip({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name?: string; payload?: Record<string, unknown> }>;
  label?: string | number;
  unit?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0];
  const name = (p.payload?.name as string) ?? (p.payload?.country as string) ?? label;
  return (
    <div className="rounded-xl border-2 border-[color:var(--bk-ink,#0f172a)] bg-white px-3 py-2 text-[13px] shadow-[0_4px_0_rgba(15,23,42,0.12)]">
      <span className="font-semibold text-[color:var(--bk-ink,#0f172a)]">{name}</span>
      <span className="ml-2 tabular-nums text-[color:var(--bk-teal-700,#0f766e)]">
        {p.value}
        {unit ? ` ${unit}` : ''}
      </span>
    </div>
  );
}

const axisTick = { fill: INK_SOFT, fontSize: 12 };

/** Horizontal ranking bars (country name → value). */
export function RankingBarChart({
  data,
  unit,
  accent = TEAL,
  height = 300,
}: {
  data: { name: string; value: number }[];
  unit?: string;
  accent?: string;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        layout="vertical"
        data={data}
        margin={{ top: 4, right: 28, bottom: 4, left: 8 }}
      >
        <CartesianGrid horizontal={false} stroke={GRID} />
        <XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} />
        <YAxis
          type="category"
          dataKey="name"
          width={96}
          tick={axisTick}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip cursor={{ fill: 'rgba(15,23,42,0.04)' }} content={<CanvasTooltip unit={unit} />} />
        <Bar dataKey="value" radius={[0, 8, 8, 0]} stroke={INK} strokeWidth={1.5} isAnimationActive={animate}>
          {data.map((_, i) => (
            <Cell key={i} fill={accent} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Vertical comparison bars (a few labelled metrics in the same unit). */
export function ComparisonBarChart({
  data,
  unit,
  accent = TEAL,
  height = 280,
}: {
  data: { name: string; value: number }[];
  unit?: string;
  accent?: string;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="name" tick={{ fill: INK_SOFT, fontSize: 11 }} axisLine={false} tickLine={false} interval={0} />
        <YAxis tick={axisTick} axisLine={false} tickLine={false} />
        <Tooltip cursor={{ fill: 'rgba(15,23,42,0.04)' }} content={<CanvasTooltip unit={unit} />} />
        <Bar dataKey="value" radius={[8, 8, 0, 0]} stroke={INK} strokeWidth={1.5} isAnimationActive={animate}>
          {data.map((_, i) => (
            <Cell key={i} fill={accent} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Area trend over years. */
export function TrendAreaChart({
  data,
  unit,
  accent = TEAL,
  height = 260,
}: {
  data: { year: number; value: number }[];
  unit?: string;
  accent?: string;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
        <defs>
          <linearGradient id={`grad-${accent.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity={0.35} />
            <stop offset="100%" stopColor={accent} stopOpacity={0.04} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="year" tick={axisTick} axisLine={false} tickLine={false} />
        <YAxis tick={axisTick} axisLine={false} tickLine={false} />
        <Tooltip content={<CanvasTooltip unit={unit} />} />
        <Area
          type="monotone"
          dataKey="value"
          stroke={accent}
          strokeWidth={2.5}
          fill={`url(#grad-${accent.replace('#', '')})`}
          isAnimationActive={animate}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Line trend (e.g. growth %). */
export function TrendLineChart({
  data,
  unit,
  accent = TEAL,
  height = 260,
}: {
  data: { year: number; value: number }[];
  unit?: string;
  accent?: string;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="year" tick={axisTick} axisLine={false} tickLine={false} />
        <YAxis tick={axisTick} axisLine={false} tickLine={false} unit={unit ? ` ${unit}` : ''} width={48} />
        <Tooltip content={<CanvasTooltip unit={unit} />} />
        <Line
          type="monotone"
          dataKey="value"
          stroke={accent}
          strokeWidth={3}
          dot={{ r: 4, fill: accent, stroke: INK, strokeWidth: 1.5 }}
          isAnimationActive={animate}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Donut for share-of-whole (e.g. sector mix). */
export function ShareDonut({
  data,
  height = 260,
}: {
  data: { name: string; value: number }[];
  height?: number;
}) {
  const palette = [TEAL, SAND, '#0f766e', 'rgba(15,23,42,0.18)', '#93e6c4'];
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius="58%"
          outerRadius="82%"
          paddingAngle={2}
          stroke={INK}
          strokeWidth={1.5}
          isAnimationActive={animate}
          label={({ name, value }) => `${name} ${value}%`}
          labelLine={false}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={palette[i % palette.length]} />
          ))}
        </Pie>
        <Tooltip content={<CanvasTooltip unit="%" />} />
      </PieChart>
    </ResponsiveContainer>
  );
}
