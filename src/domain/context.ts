import { dayKey, discountPercent, formatCad, isCadCurrency, roundMoney } from './format'
import { isQualifying } from './offers'
import { cheapestEver, chooseBest, offerQuotes } from './quotes'
import { seasonCards } from './seasons'
import type { PriceSnapshot, Store } from './types'

export type Freshness = 'fresh' | 'recent' | 'stale' | 'none'

export interface MoneyMark {
  price: number
  at: string
  storeName: string
}

export interface PriceBrief {
  currentPrice: number | null
  currentStore: string | null
  currentChecked: string | null
  inStock: boolean | null
  regularPrice: number | null
  percentOffRegular: number | null
  allTime: (MoneyMark & { outOfStock: boolean }) | null
  low30: MoneyMark | null
  low90: MoneyMark | null
  lastChecked: string | null
  freshness: Freshness
  timing: BuyTiming
}

export interface BuyTiming {
  cheapestMonth: string | null
  median: number | null
  days: number
  months: number
  sentence: string
  calendar: string | null
}

const freshHours = 36
const recentHours = 24 * 7

export function freshnessOf(iso: string | null, now = new Date()): Freshness {
  if (!iso) return 'none'
  const time = Date.parse(iso)
  if (Number.isNaN(time)) return 'none'
  const hours = (now.getTime() - time) / 3600000
  if (hours <= freshHours) return 'fresh'
  if (hours <= recentHours) return 'recent'
  return 'stale'
}

export function freshnessLabel(freshness: Freshness): string {
  switch (freshness) {
    case 'fresh':
      return 'Checked recently'
    case 'recent':
      return 'Last check is a few days old'
    case 'stale':
      return 'Last check is over a week old'
    case 'none':
      return 'No check saved'
    default: {
      const neverFreshness: never = freshness
      return neverFreshness
    }
  }
}

export function priceBrief(snapshots: PriceSnapshot[], stores: Store[], now = new Date()): PriceBrief {
  const qualifying = snapshots.filter(isQualifying)
  const current = chooseBest(offerQuotes(qualifying, stores))
  const ever = cheapestEver(qualifying)
  const low30 = windowLow(qualifying, stores, now, 30)
  const low90 = windowLow(qualifying, stores, now, 90)
  const lastChecked = latestCapture(snapshots)
  const percent = current ? discountPercent(current.price, current.regularPrice) : null
  return {
    currentPrice: current?.price ?? null,
    currentStore: current?.storeName ?? null,
    currentChecked: current?.capturedAt ?? null,
    inStock: current?.inStock ?? null,
    regularPrice: current?.regularPrice ?? null,
    percentOffRegular: percent,
    allTime: ever
      ? {
          price: ever.snapshot.price,
          at: ever.snapshot.captured_at,
          storeName: storeName(stores, ever.snapshot.store_id),
          outOfStock: ever.outOfStock,
        }
      : null,
    low30,
    low90,
    lastChecked,
    freshness: freshnessOf(lastChecked, now),
    timing: buyTiming(qualifying, now),
  }
}

export function buyTiming(snapshots: PriceSnapshot[], now = new Date()): BuyTiming {
  const byMonth = new Map<string, { label: string; days: Map<string, number> }>()
  for (const snapshot of snapshots) {
    if (!isQualifying(snapshot) || snapshot.in_stock === false || !isCadCurrency(snapshot.currency)) continue
    const month = torontoMonth(snapshot.captured_at)
    const day = dayKey(snapshot.captured_at)
    if (!month || !day) continue
    const bucket = byMonth.get(month.key) ?? { label: month.label, days: new Map<string, number>() }
    const current = bucket.days.get(day)
    if (current == null || snapshot.price < current) bucket.days.set(day, snapshot.price)
    byMonth.set(month.key, bucket)
  }
  const usable = [...byMonth.entries()]
    .map(([key, bucket]) => ({
      key,
      label: bucket.label,
      days: bucket.days.size,
      median: median([...bucket.days.values()]),
    }))
    .filter((month) => month.days >= 2)
  const calendar = calendarNote(now)
  if (usable.length < 2) {
    return {
      cheapestMonth: null,
      median: null,
      days: usable[0]?.days ?? 0,
      months: usable.length,
      sentence: 'Fewer than two months of in-stock prices are saved, so there is no cheaper month to name.',
      calendar,
    }
  }
  usable.sort((left, right) => left.median - right.median || right.days - left.days || left.key.localeCompare(right.key))
  const cheapest = usable[0]
  if (!cheapest) {
    return {
      cheapestMonth: null,
      median: null,
      days: 0,
      months: 0,
      sentence: 'Fewer than two months of in-stock prices are saved, so there is no cheaper month to name.',
      calendar,
    }
  }
  const currentKey = torontoMonth(now.toISOString())?.key
  const sameMonth = currentKey === cheapest.key ? ' That is the current month.' : ''
  return {
    cheapestMonth: cheapest.label,
    median: roundMoney(cheapest.median),
    days: cheapest.days,
    months: usable.length,
    sentence: `In-stock prices were lowest in ${cheapest.label}. The median of those daily lows was ${formatCad(cheapest.median)} across ${cheapest.days} days.${sameMonth}`,
    calendar,
  }
}

function windowLow(snapshots: PriceSnapshot[], stores: Store[], now: Date, days: number): MoneyMark | null {
  const start = now.getTime() - days * 86400000
  const windowed = snapshots.filter((snapshot) => {
    if (!isQualifying(snapshot) || snapshot.in_stock === false || !isCadCurrency(snapshot.currency)) return false
    const time = Date.parse(snapshot.captured_at)
    return !Number.isNaN(time) && time >= start && time <= now.getTime()
  })
  let best: PriceSnapshot | null = null
  for (const snapshot of windowed) {
    if (!best || snapshot.price < best.price || (snapshot.price === best.price && snapshot.captured_at < best.captured_at)) {
      best = snapshot
    }
  }
  if (!best) return null
  return { price: best.price, at: best.captured_at, storeName: storeName(stores, best.store_id) }
}

function latestCapture(snapshots: PriceSnapshot[]): string | null {
  let best: string | null = null
  let bestTime = Number.NEGATIVE_INFINITY
  for (const snapshot of snapshots) {
    const time = Date.parse(snapshot.captured_at)
    if (Number.isNaN(time) || time < bestTime) continue
    bestTime = time
    best = snapshot.captured_at
  }
  return best
}

function calendarNote(now: Date): string | null {
  const dated = seasonCards(now).filter((card) => card.days != null)
  dated.sort((left, right) => (left.days ?? 0) - (right.days ?? 0))
  const next = dated[0]
  if (!next || next.days == null) return null
  const when = next.days === 0 ? 'today' : next.days === 1 ? 'in 1 day' : `in ${next.days} days`
  return `${next.name} is ${when} (${next.when}). That date is the calendar, not a price saved in Harbour.`
}

function torontoMonth(iso: string): { key: string; label: string } | null {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  const key = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto',
    year: 'numeric',
    month: '2-digit',
  }).format(date)
  const label = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto',
    month: 'long',
    year: 'numeric',
  }).format(date)
  return { key, label }
}

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right)
  const mid = Math.floor(sorted.length / 2)
  const upper = sorted[mid]
  if (upper == null) return 0
  if (sorted.length % 2 === 1) return upper
  const lower = sorted[mid - 1] ?? upper
  return (lower + upper) / 2
}

function storeName(stores: Store[], storeId: string | null): string {
  if (!storeId) return 'Unknown store'
  return stores.find((store) => store.id === storeId)?.name ?? 'Unknown store'
}
