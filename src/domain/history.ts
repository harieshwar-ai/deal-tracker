import { dayKey, isCadCurrency } from './format'
import { seriesColor } from './palette'
import type { PriceSnapshot, Store } from './types'

export const HISTORY_TOP_STORES = 6
export const HISTORY_OTHER_SERIES_ID = 'other'

export interface HistorySeries {
  id: string
  name: string
  color: string
}

export interface PriceHistory {
  rows: Record<string, string | number | null>[]
  series: HistorySeries[]
  /** Tooltip copy keyed by row date, then series id */
  listingBySeries: Record<string, Record<string, string>>
}

export type HistoryChartState = 'empty' | 'points' | 'ready'
export type ChartRange = '7d' | '30d' | '90d' | 'all'

export function parseChartRange(value: string | null): ChartRange {
  switch (value) {
    case '7d':
    case '30d':
    case '90d':
    case 'all':
      return value
    default:
      return '90d'
  }
}

export function withinChartRange(iso: string, range: ChartRange, now = Date.now()): boolean {
  if (range === 'all') return true
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90
  const time = Date.parse(iso)
  return !Number.isNaN(time) && time >= now - days * 86_400_000
}

export function historyChartState(dayCount: number): HistoryChartState {
  if (dayCount <= 0) return 'empty'
  if (dayCount < 5) return 'points'
  return 'ready'
}

export function truncateListingLabel(text: string, max = 52): string {
  const trimmed = text.trim()
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max - 1)}…`
}

export function buildPriceHistory(snapshots: PriceSnapshot[], stores: Store[]): PriceHistory {
  const relevant = snapshots.filter((snapshot) => isCadCurrency(snapshot.currency) && snapshot.in_stock !== false)
  const ordered = [...stores].sort((left, right) => left.name.localeCompare(right.name))
  const storeName = (storeId: string) =>
    storeId === 'unknown' ? 'Unknown store' : (stores.find((store) => store.id === storeId)?.name ?? 'Unknown store')

  const activity = new Map<string, number>()
  for (const snapshot of relevant) {
    const storeId = snapshot.store_id ?? 'unknown'
    activity.set(storeId, (activity.get(storeId) ?? 0) + 1)
  }
  const rankedStores = [...activity.entries()]
    .sort((left, right) => right[1] - left[1] || storeName(left[0]).localeCompare(storeName(right[0])))
    .map(([storeId]) => storeId)
  const featuredStores = rankedStores.slice(0, HISTORY_TOP_STORES)
  const featuredSet = new Set(featuredStores)
  const hasOtherBucket = rankedStores.length > featuredStores.length

  const seriesIds = [...featuredStores, ...(hasOtherBucket ? [HISTORY_OTHER_SERIES_ID] : [])]
  const days = [...new Set(relevant.map((snapshot) => dayKey(snapshot.captured_at)).filter(Boolean))].sort()
  const listingBySeries: Record<string, Record<string, string>> = {}

  const rows = days.map((day) => {
    const row: Record<string, string | number | null> = { date: day }
    const listings: Record<string, string> = {}
    for (const id of seriesIds) row[id] = null

    const daySnapshots = relevant.filter((snapshot) => dayKey(snapshot.captured_at) === day)
    for (const storeId of featuredStores) {
      const winners = daySnapshots.filter((snapshot) => (snapshot.store_id ?? 'unknown') === storeId)
      const best = lowestSnapshot(winners)
      if (best) {
        row[storeId] = best.price
        listings[storeId] = listingLabel(best, storeName(storeId))
      }
    }

    if (hasOtherBucket) {
      const winners = daySnapshots.filter((snapshot) => !featuredSet.has(snapshot.store_id ?? 'unknown'))
      const best = lowestSnapshot(winners)
      if (best) {
        row[HISTORY_OTHER_SERIES_ID] = best.price
        listings[HISTORY_OTHER_SERIES_ID] = listingLabel(best, storeName(best.store_id ?? 'unknown'))
      }
    }

    listingBySeries[day] = listings
    return row
  })

  const series = seriesIds.map((id, index) => {
    if (id === HISTORY_OTHER_SERIES_ID) {
      return { id, name: 'Other', color: seriesColor(ordered.length + index) }
    }
    const storeIndex = ordered.findIndex((store) => store.id === id)
    return { id, name: storeName(id), color: seriesColor(storeIndex >= 0 ? storeIndex : index) }
  })

  return { rows, series, listingBySeries }
}

function lowestSnapshot(snapshots: PriceSnapshot[]): PriceSnapshot | null {
  let best: PriceSnapshot | null = null
  for (const snapshot of snapshots) {
    if (!best || snapshot.price < best.price || (snapshot.price === best.price && snapshot.id > best.id)) {
      best = snapshot
    }
  }
  return best
}

function listingLabel(snapshot: PriceSnapshot, storeLabel: string): string {
  const product = (snapshot.product_name || snapshot.product_title || '').trim()
  return product ? `${storeLabel} · ${product}` : storeLabel
}
