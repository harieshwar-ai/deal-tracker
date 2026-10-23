import { Link } from 'react-router-dom'
import { CountUp } from './motion'
import { freshnessLabel, freshnessOf } from '../domain/context'
import { formatCad, formatRelative } from '../domain/format'
import type { HeroStats } from '../domain/hero'
import { priceCallLabel, priceCallTone } from '../domain/verdict'
import { Badge } from './ui'

function formatCount(value: number): string {
  return String(Math.round(value))
}

export function HeroStrip({ stats }: { stats: HeroStats }) {
  return (
    <section className="mt-6 grid gap-3 lg:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,0.7fr))]" aria-label="Watchlist summary">
      <article className="rounded-xl border-2 border-pine shadow-sm bg-[color-mix(in_srgb,var(--color-pine)_18%,var(--color-bark))] px-5 py-4 text-foam">
        <p className="text-xs font-medium tracking-wide text-foam/90 uppercase">Best deal right now</p>
        {stats.best ? (
          <>
            <h2 className="mt-2 font-display text-3xl leading-none">
              <Link className="hover:text-white" to={`/items/${stats.best.itemId}`}>{stats.best.name}</Link>
            </h2>
            <p className="mt-2 font-mono text-2xl font-medium tracking-tight tabular-nums">
              <CountUp value={stats.best.price} format={formatCad} />
            </p>
            <p className="mt-1 text-sm">
              at {stats.best.storeName}
              {stats.best.saving > 0 ? ` · ${formatCad(stats.best.saving)} under the regular price` : ''}
            </p>
            <Badge className={`mt-3 ${priceCallTone(stats.best.call)}`}>{priceCallLabel(stats.best.call)}</Badge>
          </>
        ) : (
          <p className="mt-3 text-sm text-foam/80">{stats.empty === 'unqualified' ? 'No qualifying offer yet' : 'No in-stock CAD price yet.'}</p>
        )}
      </article>
      <HeroStat label="Items tracked" value={formatCount(stats.tracked)} count={stats.tracked} format={formatCount} detail="Active items on the list" />
      <HeroStat label="Total savings found" value={formatCad(stats.savings)} count={stats.savings} format={formatCad} detail="Current prices under their listed regular prices" />
      <HeroStat label="Last scan" value={stats.lastScan ? formatRelative(stats.lastScan) : '—'} detail={stats.lastScan ? freshnessLabel(freshnessOf(stats.lastScan)) : 'No snapshots yet'} />
    </section>
  )
}

function HeroStat({
  label,
  value,
  detail,
  count,
  format,
}: {
  label: string
  value: string
  detail: string
  count?: number
  format?: (value: number) => string
}) {
  return (
    <article className="rounded-xl border border-line bg-paper-2 px-4 py-4 shadow-sm">
      <p className="text-xs font-medium tracking-wide text-muted uppercase">{label}</p>
      <p className="mt-2 font-mono text-2xl font-medium tracking-tight tabular-nums">
        {count != null && format ? <CountUp value={count} format={format} /> : value}
      </p>
      <p className="mt-1 text-sm font-medium text-muted">{detail}</p>
    </article>
  )
}
