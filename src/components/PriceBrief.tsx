import { formatCad, formatPct, formatRelative } from '../domain/format'
import { freshnessLabel } from '../domain/context'
import type { PriceBrief as Brief } from '../domain/context'
import { cn } from '../lib/cn'

export function PriceBrief({
  brief,
  owner,
}: {
  brief: Brief
  owner?: { target: string; max: string; gap: string } | null
}) {
  const off = brief.percentOffRegular
  const offText = off == null
    ? 'No regular price on the current offer'
    : off > 0
      ? `${formatPct(off, 0)} off the listed regular price`
      : off < 0
        ? `${formatPct(Math.abs(off), 0)} above the listed regular price`
        : 'Same as the listed regular price'
  return (
    <section className="mt-4" aria-label="Price summary">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Current qualifying price"
          value={brief.currentPrice != null ? formatCad(brief.currentPrice) : '—'}
          detail={brief.currentStore
            ? `${brief.currentStore}${brief.inStock === false ? ' · out of stock' : ''}${brief.currentChecked ? ` · ${formatRelative(brief.currentChecked)}` : ''}`
            : 'No qualifying offer yet'}
        />
        <Stat
          label={brief.allTime?.outOfStock ? 'Cheapest seen, out of stock' : 'All-time low'}
          value={brief.allTime ? formatCad(brief.allTime.price) : '—'}
          detail={brief.allTime ? `${brief.allTime.storeName} · ${formatRelative(brief.allTime.at)}` : 'No qualifying CAD price yet'}
          tone={brief.allTime && !brief.allTime.outOfStock && brief.currentPrice != null && brief.currentPrice <= brief.allTime.price + 0.001 ? 'drop' : undefined}
        />
        <Stat
          label="30-day low"
          value={brief.low30 ? formatCad(brief.low30.price) : '—'}
          detail={brief.low30 ? `${brief.low30.storeName} · in stock` : 'No in-stock price in the last 30 days'}
        />
        <Stat
          label="90-day low"
          value={brief.low90 ? formatCad(brief.low90.price) : '—'}
          detail={brief.low90 ? `${brief.low90.storeName} · in stock` : 'No in-stock price in the last 90 days'}
        />
        <Stat
          label="Vs regular"
          value={off != null && off > 0 ? formatPct(off, 0) : '—'}
          detail={offText}
          tone={off != null && off > 0 ? 'drop' : off != null && off < 0 ? 'rise' : undefined}
        />
        <Stat
          label="Last check"
          value={brief.lastChecked ? formatRelative(brief.lastChecked) : '—'}
          detail={freshnessLabel(brief.freshness)}
          tone={brief.freshness === 'stale' ? 'wait' : undefined}
        />
        {owner ? <Stat label="Target" value={owner.target} detail={owner.gap} /> : null}
        {owner ? <Stat label="Max price" value={owner.max} detail="Only visible while you are signed in" /> : null}
      </div>
      <div className="mt-3 rounded-xl border border-line bg-paper-2 px-4 py-3 text-sm leading-6">
        <p>{brief.timing.sentence}</p>
        {brief.timing.calendar ? <p className="mt-1 text-muted">{brief.timing.calendar}</p> : null}
      </div>
    </section>
  )
}

function Stat({
  label,
  value,
  detail,
  tone,
}: {
  label: string
  value: string
  detail: string
  tone?: 'drop' | 'rise' | 'wait'
}) {
  return (
    <article className="rounded-xl border border-line bg-paper-2 p-4 shadow-sm">
      <p className="text-xs font-medium tracking-wide text-muted uppercase">{label}</p>
      <p className={cn('mt-1 font-mono text-2xl font-medium tracking-tight tabular-nums', tone === 'drop' && 'text-drop', tone === 'rise' && 'text-rise', tone === 'wait' && 'text-wait')}>{value}</p>
      <p className="mt-1 text-sm font-medium text-muted">{detail}</p>
    </article>
  )
}
