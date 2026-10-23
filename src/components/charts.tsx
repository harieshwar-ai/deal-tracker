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
import { palette, storePalette } from '../domain/palette'
import { useTheme } from '../theme/theme'
import type { StoreIndexSeries } from '../domain/analytics'
import type { HistorySeries } from '../domain/history'

type ChartColors = { [Key in keyof typeof palette]: string }

const darkStoreStrokes = ['#3dbe9a', '#e2b15a', '#8eb4d8', '#e0a3bc', '#a8d48f', '#7dcec8', '#e2a15a', '#aeb6e8'] as const

function useChartColors(): ChartColors {
  const { resolved } = useTheme()
  if (resolved === 'dark') {
    return {
      ...palette,
      pine: '#3dbe9a',
      gold: '#e2b15a',
      sea: '#8eb4d8',
      ink: '#eef2f6',
      muted: '#9aa6b2',
      grid: '#2a3340',
      paper: '#151a21',
    }
  }
  return palette
}

function useStoreStrokes(): readonly string[] {
  const { resolved } = useTheme()
  return resolved === 'dark' ? darkStoreStrokes : storePalette
}

function chartLook(colors: ChartColors) {
  const tick = { fill: colors.muted, fontSize: 12, fontFamily: 'Geist Variable, ui-sans-serif, sans-serif' }
  return {
    colors,
    grid: { stroke: colors.grid, vertical: false as const },
    tick,
    dateAxis: { tick, minTickGap: 64, interval: 'preserveStartEnd' as const },
    tooltip: {
      background: colors.paper,
      border: `1px solid ${colors.grid}`,
      borderRadius: 12,
      fontSize: 13,
      fontFamily: 'Geist Variable, ui-sans-serif, sans-serif',
      color: colors.ink,
    },
  }
}

function zoomedDomain([min, max]: [number, number], include?: number | null | Array<number | null>): [number, number] {
  const extras = (Array.isArray(include) ? include : [include]).filter((value): value is number => value != null && Number.isFinite(value))
  const low = extras.length > 0 ? Math.min(min, ...extras) : min
  const high = extras.length > 0 ? Math.max(max, ...extras) : max
  const span = high - low || Math.abs(high) * 0.08 || 1
  const floor = Math.min(low, 0) < 0 ? low - span * 0.12 : Math.max(0, low - span * 0.12)
  return [Math.floor(floor), Math.ceil(high + span * 0.12)]
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
  points = false,
}: {
  rows: Record<string, string | number | null>[]
  series: HistorySeries[]
  target: number | null
  low: number | null
  points?: boolean
}) {
  const look = chartLook(useChartColors())
  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid {...look.grid} />
          <XAxis dataKey="date" tickFormatter={formatAxisDay} {...look.dateAxis} />
          <YAxis tickFormatter={axisMoney} width={72} tick={{ fill: look.colors.muted, fontSize: 12 }} domain={([min, max]) => zoomedDomain([min, max], [target, low])} />
          <Tooltip contentStyle={look.tooltip} formatter={(value) => formatTooltip('money', value)} labelFormatter={(label) => formatAxisDay(String(label))} />
          <Legend />
          {low != null ? <ReferenceLine y={low} stroke={look.colors.pine} strokeDasharray="2 4" label={{ value: 'All-time low', position: 'insideTopRight', fill: look.colors.pine }} /> : null}
          {target != null ? <ReferenceLine y={target} stroke={look.colors.gold} strokeDasharray="4 4" label={{ value: 'Target', position: 'insideTopLeft', fill: look.colors.gold }} /> : null}
          {series.map((entry) => (
            <Line
              key={entry.id}
              type={points ? 'linear' : 'monotone'}
              dataKey={entry.id}
              name={entry.name}
              stroke={entry.color}
              strokeWidth={2}
              dot={{ r: points ? 4 : 2 }}
              connectNulls={points}
              isAnimationActive={prefersMotion()}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export function IndexChart({ points }: { points: { date: string; index: number }[] }) {
  const look = chartLook(useChartColors())
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid {...look.grid} />
          <XAxis dataKey="date" tickFormatter={formatAxisDay} {...look.dateAxis} />
          <YAxis tick={{ fill: look.colors.muted, fontSize: 12 }} width={48} domain={([min, max]) => zoomedDomain([min, max], 100)} />
          <Tooltip contentStyle={look.tooltip} formatter={(value) => formatTooltip('index', value)} labelFormatter={(label) => formatAxisDay(String(label))} />
          <ReferenceLine y={100} stroke={look.colors.muted} strokeDasharray="4 4" />
          <Line type="monotone" dataKey="index" name="Price index" stroke={look.colors.ink} strokeWidth={2.4} dot={false} isAnimationActive={prefersMotion()} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export function StoreTrendChart({ series }: { series: StoreIndexSeries[] }) {
  const look = chartLook(useChartColors())
  const strokes = useStoreStrokes()
  const rows = (series[0]?.points ?? []).map((point, index) => {
    const row: Record<string, string | number | null> = { date: point.date }
    for (const entry of series) row[entry.storeId] = entry.points[index]?.index ?? null
    return row
  })
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid {...look.grid} />
          <XAxis dataKey="date" tickFormatter={formatAxisDay} {...look.dateAxis} />
          <YAxis tick={{ fill: look.colors.muted, fontSize: 12 }} width={48} domain={([min, max]) => zoomedDomain([min, max], 100)} />
          <Tooltip contentStyle={look.tooltip} formatter={(value) => formatTooltip('index', value)} labelFormatter={(label) => formatAxisDay(String(label))} />
          <Legend />
          <ReferenceLine y={100} stroke={look.colors.muted} strokeDasharray="4 4" />
          {series.map((entry, index) => (
            <Line
              key={entry.storeId}
              type="monotone"
              dataKey={entry.storeId}
              name={entry.storeName}
              stroke={strokes[index % strokes.length] ?? look.colors.pine}
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
  const look = chartLook(useChartColors())
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid {...look.grid} />
          <XAxis dataKey="date" tickFormatter={formatAxisDay} {...look.dateAxis} />
          <YAxis tickFormatter={axisMoney} width={72} tick={{ fill: look.colors.muted, fontSize: 12 }} />
          <Tooltip contentStyle={look.tooltip} formatter={(value) => formatTooltip('money', value)} labelFormatter={(label) => formatAxisDay(String(label))} />
          <Area type="monotone" dataKey="savings" name="Vs regular" stroke={look.colors.pine} fill={look.colors.pine} fillOpacity={0.18} isAnimationActive={prefersMotion()} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export function WinsChart({ rows }: { rows: { storeName: string; wins: number }[] }) {
  const look = chartLook(useChartColors())
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid {...look.grid} />
          <XAxis type="number" allowDecimals={false} tick={{ fill: look.colors.muted, fontSize: 12 }} />
          <YAxis type="category" dataKey="storeName" width={128} tick={{ fill: look.colors.ink, fontSize: 12 }} />
          <Tooltip contentStyle={look.tooltip} formatter={(value) => formatTooltip('count', value)} />
          <Bar dataKey="wins" name="Cheapest item-days" fill={look.colors.pine} radius={6} isAnimationActive={prefersMotion()} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function DiscountChart({ rows }: { rows: { storeName: string; avgDiscountPct: number }[] }) {
  const look = chartLook(useChartColors())
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid {...look.grid} />
          <XAxis type="number" tick={{ fill: look.colors.muted, fontSize: 12 }} unit="%" />
          <YAxis type="category" dataKey="storeName" width={140} tick={{ fill: look.colors.ink, fontSize: 12 }} />
          <Tooltip contentStyle={look.tooltip} formatter={(value) => `${formatTooltip('index', value)}%`} />
          <Bar dataKey="avgDiscountPct" name="Avg discount" fill={look.colors.gold} radius={6} isAnimationActive={prefersMotion()} />
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
  const look = chartLook(useChartColors())
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid {...look.grid} />
          <XAxis dataKey="date" tickFormatter={formatAxisDay} {...look.dateAxis} />
          <YAxis allowDecimals={false} tick={{ fill: look.colors.muted, fontSize: 12 }} />
          <Tooltip contentStyle={look.tooltip} labelFormatter={(label) => formatAxisDay(String(label))} />
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
  const look = chartLook(useChartColors())
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid {...look.grid} />
          <XAxis dataKey="label" tick={{ fill: look.colors.muted, fontSize: 12 }} />
          <YAxis allowDecimals={false} tick={{ fill: look.colors.muted, fontSize: 12 }} />
          <Tooltip contentStyle={look.tooltip} />
          <Bar dataKey="count" name="Deals" fill={look.colors.sea} radius={6} isAnimationActive={prefersMotion()} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
