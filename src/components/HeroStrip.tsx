import { Link } from 'react-router-dom'
import { formatCad, formatRelative } from '../domain/format'
import type { HeroStats } from '../domain/hero'
import { priceCallLabel, priceCallTone } from '../domain/verdict'
import { Badge } from './ui'

export function HeroStrip({ stats }: { stats: HeroStats }) {
  return (
    <section className="mt-6 grid gap-3 lg:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,0.7fr))]" aria-label="Watchlist summary">
      <article className="rounded-3xl bg-bark px-5 py-4 text-foam">
        <p className="text-xs uppercase tracking-[0.14em] text-foam/70">Best deal right now</p>
        {stats.best ? (
          <>
            <h2 className="mt-2 font-display text-3xl leading-none">
              <Link className="hover:text-white" to={`/items/${stats.best.itemId}`}>{stats.best.name}</Link>
            </h2>
            <p className="mt-2 text-sm">
              {formatCad(stats.best.price)} at {stats.best.storeName}
              {stats.best.saving > 0 ? ` · ${formatCad(stats.best.saving)} under the regular price` : ''}
            </p>
            <Badge className={`mt-3 ${priceCallTone(stats.best.call)}`}>{priceCallLabel(stats.best.call)}</Badge>
          </>
        ) : (
          <p className="mt-3 text-sm text-foam/80">No in-stock CAD price yet.</p>
        )}
      </article>
      <HeroStat label="Items tracked" value={String(stats.tracked)} detail="Active items on the list" />
      <HeroStat label="Total savings found" value={formatCad(stats.savings)} detail="Current prices under their listed regular prices" />
      <HeroStat label="Last scan" value={stats.lastScan ? formatRelative(stats.lastScan) : '—'} detail={stats.lastScan ? 'Newest saved price' : 'No snapshots yet'} />
    </section>
  )
}

function HeroStat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className="rounded-3xl border border-line bg-paper-2 px-4 py-4">
      <p className="text-xs uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className="mt-2 font-display text-3xl tabular-nums">{value}</p>
      <p className="mt-1 text-sm text-muted">{detail}</p>
    </article>
  )
}
