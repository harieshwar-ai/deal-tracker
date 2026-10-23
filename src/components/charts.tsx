import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatAxisDay, formatCad } from '../domain/format'
import { verdictChartColor } from '../domain/labels'
import { palette } from '../domain/palette'
import type { StoreIndexSeries } from '../domain/analytics'
import type { HistorySeries } from '../domain/history'

const grid = { stroke: palette.grid, vertical: false }
const dateTick = { fill: palette.muted, fontSize: 12 }
const dateAxis = {
  tick: dateTick,
  minTickGap: 64,
  interval: 'preserveStartEnd' as const,
}

function zoomedDomain([min, max]: [number, number], include?: number | null | Array<number | null>): [number, number] {
  const extras = (Array.isArray(include) ? include : [include]).filter((value): value is number => value != null && Number.isFinite(value))
  const low = extras.length > 0 ? Math.min(min, ...extras) : min
  const high = extras.length > 0 ? Math.max(max, ...extras) : max
  const span = high - low || Math.abs(high) * 0.08 || 1
  const floor = Math.min(low, 0) < 0 ? low - span * 0.12 : Math.max(0, low - span * 0.12)
  return [Math.floor(floor), Math.ceil(high + span * 0.12)]
}
const tooltipStyle = {
  background: palette.paper,
  border: `1px solid ${palette.grid}`,
  borderRadius: 12,
  fontSize: 13,
}

function prefersMotion(): boolean {
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function formatTooltip(kind: 'money' | 'index' | 'count', value: unknown): string {
  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numeric)) return '—'
  if (kind === 'money') return formatCad(numeric)
  if (kind === 'index') return numeric.toFixed(1)
  return String(Math.round(numeric))
}

function axisMoney(value: number): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 0,
  }).format(value)
}

export function PriceHistoryChart({
  rows,
  series,
  target,
  low,
}: {
  rows: Record<string, string | number | null>[]
  series: HistorySeries[]
  target: number | null
  low: number | null
}) {
  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid {...grid} />
          <XAxis dataKey="date" tickFormatter={formatAxisDay} {...dateAxis} />
          <YAxis tickFormatter={axisMoney} width={72} tick={{ fill: palette.muted, fontSize: 12 }} domain={([min, max]) => zoomedDomain([min, max], [target, low])} />
          <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatTooltip('money', value)} labelFormatter={(label) => formatAxisDay(String(label))} />
          <Legend />
          {low != null ? <ReferenceLine y={low} stroke={palette.pine} strokeDasharray="2 4" label={{ value: 'All-time low', position: 'insideTopRight', fill: palette.pine }} /> : null}
          {target != null ? <ReferenceLine y={target} stroke={palette.gold} strokeDasharray="4 4" label={{ value: 'Target', position: 'insideTopLeft', fill: palette.gold }} /> : null}
          {series.map((entry) => (
            <Line
              key={entry.id}
              type="monotone"
              dataKey={entry.id}
              name={entry.name}
              stroke={entry.color}
              strokeWidth={2}
              dot={{ r: 2 }}
              connectNulls={false}
              isAnimationActive={prefersMotion()}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export function IndexChart({ points }: { points: { date: string; index: number }[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid {...grid} />
          <XAxis dataKey="date" tickFormatter={formatAxisDay} {...dateAxis} />
          <YAxis tick={{ fill: palette.muted, fontSize: 12 }} width={48} domain={([min, max]) => zoomedDomain([min, max], 100)} />
          <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatTooltip('index', value)} labelFormatter={(label) => formatAxisDay(String(label))} />
          <ReferenceLine y={100} stroke={palette.muted} strokeDasharray="4 4" />
          <Line type="monotone" dataKey="index" name="Price index" stroke={palette.ink} strokeWidth={2.4} dot={false} isAnimationActive={prefersMotion()} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export function StoreTrendChart({ series }: { series: StoreIndexSeries[] }) {
  const rows = (series[0]?.points ?? []).map((point, index) => {
    const row: Record<string, string | number | null> = { date: point.date }
    for (const entry of series) row[entry.storeId] = entry.points[index]?.index ?? null
    return row
  })
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid {...grid} />
          <XAxis dataKey="date" tickFormatter={formatAxisDay} {...dateAxis} />
          <YAxis tick={{ fill: palette.muted, fontSize: 12 }} width={48} domain={([min, max]) => zoomedDomain([min, max], 100)} />
          <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatTooltip('index', value)} labelFormatter={(label) => formatAxisDay(String(label))} />
          <Legend />
          <ReferenceLine y={100} stroke={palette.muted} strokeDasharray="4 4" />
          {series.map((entry, index) => (
            <Line
              key={entry.storeId}
              type="monotone"
              dataKey={entry.storeId}
              name={entry.storeName}
              stroke={['#0e6b4f', '#b86114', '#1e4d7b', '#7a3e5a', '#3d6b2f', '#0f6f78', '#8a4b08'][index % 7]}
              strokeWidth={2}
              dot={false}
              connectNulls
              isAnimationActive={prefersMotion()}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export function SavingsChart({ points }: { points: { date: string; savings: number }[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid {...grid} />
          <XAxis dataKey="date" tickFormatter={formatAxisDay} {...dateAxis} />
          <YAxis tickFormatter={axisMoney} width={72} tick={{ fill: palette.muted, fontSize: 12 }} />
          <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatTooltip('money', value)} labelFormatter={(label) => formatAxisDay(String(label))} />
          <Area type="monotone" dataKey="savings" name="Vs regular" stroke={palette.pine} fill={palette.pine} fillOpacity={0.18} isAnimationActive={prefersMotion()} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export function WinsChart({ rows }: { rows: { storeName: string; wins: number }[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid {...grid} />
          <XAxis type="number" allowDecimals={false} tick={{ fill: palette.muted, fontSize: 12 }} />
          <YAxis type="category" dataKey="storeName" width={128} tick={{ fill: palette.ink, fontSize: 12 }} />
          <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatTooltip('count', value)} />
          <Bar dataKey="wins" name="Cheapest item-days" fill={palette.pine} radius={6} isAnimationActive={prefersMotion()} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function DiscountChart({ rows }: { rows: { storeName: string; avgDiscountPct: number }[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid {...grid} />
          <XAxis type="number" tick={{ fill: palette.muted, fontSize: 12 }} unit="%" />
          <YAxis type="category" dataKey="storeName" width={140} tick={{ fill: palette.ink, fontSize: 12 }} />
          <Tooltip contentStyle={tooltipStyle} formatter={(value) => `${formatTooltip('index', value)}%`} />
          <Bar dataKey="avgDiscountPct" name="Avg discount" fill={palette.gold} radius={6} isAnimationActive={prefersMotion()} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function DealFlowChart({
  rows,
}: {
  rows: { date: string; must_buy: number; good: number; ok: number; skip: number; unrated: number }[]
}) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid {...grid} />
          <XAxis dataKey="date" tickFormatter={formatAxisDay} {...dateAxis} />
          <YAxis allowDecimals={false} tick={{ fill: palette.muted, fontSize: 12 }} />
          <Tooltip contentStyle={tooltipStyle} labelFormatter={(label) => formatAxisDay(String(label))} />
          <Legend />
          <Bar dataKey="must_buy" name="Must buy" stackId="deals" fill={verdictChartColor('must_buy')} />
          <Bar dataKey="good" name="Good" stackId="deals" fill={verdictChartColor('good')} />
          <Bar dataKey="ok" name="OK" stackId="deals" fill={verdictChartColor('ok')} />
          <Bar dataKey="skip" name="Skip" stackId="deals" fill={verdictChartColor('skip')} />
          <Bar dataKey="unrated" name="Unrated" stackId="deals" fill={verdictChartColor('unrated')} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function ScoreChart({ rows }: { rows: { label: string; count: number }[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid {...grid} />
          <XAxis dataKey="label" tick={{ fill: palette.muted, fontSize: 12 }} />
          <YAxis allowDecimals={false} tick={{ fill: palette.muted, fontSize: 12 }} />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar dataKey="count" name="Deals" fill={palette.sea} radius={6} isAnimationActive={prefersMotion()} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
