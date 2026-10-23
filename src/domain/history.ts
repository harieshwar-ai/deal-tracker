import { dayKey, isCadCurrency } from './format'
import { seriesColor } from './palette'
import type { PriceSnapshot, Store } from './types'

export interface HistorySeries {
  id: string
  name: string
  color: string
}

export interface PriceHistory {
  rows: Record<string, string | number | null>[]
  series: HistorySeries[]
}

export type HistoryChartState = 'empty' | 'points' | 'ready'

export function historyChartState(dayCount: number): HistoryChartState {
  if (dayCount <= 0) return 'empty'
  if (dayCount < 5) return 'points'
  return 'ready'
}

export function buildPriceHistory(snapshots: PriceSnapshot[], stores: Store[]): PriceHistory {
  const relevant = snapshots.filter((snapshot) => isCadCurrency(snapshot.currency))
  const ordered = [...stores].sort((left, right) => left.name.localeCompare(right.name))
  const ids = [...new Set(relevant.map((snapshot) => seriesId(snapshot)))]
  const days = [...new Set(relevant.map((snapshot) => dayKey(snapshot.captured_at)).filter(Boolean))].sort()
  const rows = days.map((day) => {
    const row: Record<string, string | number | null> = { date: day }
    for (const id of ids) row[id] = null
    for (const snapshot of relevant) {
      if (dayKey(snapshot.captured_at) !== day) continue
      const id = seriesId(snapshot)
      const current = row[id]
      if (typeof current !== 'number' || snapshot.price < current) row[id] = snapshot.price
    }
    return row
  })
  const series = ids.map((id, index) => {
    const storeId = id.split('::')[0] ?? 'unknown'
    const storeIndex = ordered.findIndex((store) => store.id === storeId)
    return { id, name: seriesName(id, stores), color: seriesColor(storeIndex >= 0 ? storeIndex : index) }
  })
  return { rows, series }
}

function seriesId(snapshot: PriceSnapshot): string {
  const product = (snapshot.product_name || '').trim()
  const storeId = snapshot.store_id ?? 'unknown'
  return product ? `${storeId}::${product}` : storeId
}

function seriesName(id: string, stores: Store[]): string {
  const splitAt = id.indexOf('::')
  const storeId = splitAt === -1 ? id : id.slice(0, splitAt)
  const product = splitAt === -1 ? '' : id.slice(splitAt + 2)
  const name = storeId === 'unknown' ? 'Unknown store' : (stores.find((store) => store.id === storeId)?.name ?? 'Unknown store')
  return product ? `${name} · ${product}` : name
}
