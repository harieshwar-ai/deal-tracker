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

export type HistoryChartState = 'empty' | 'sparse' | 'ready'

export function historyChartState(dayCount: number): HistoryChartState {
  if (dayCount <= 0) return 'empty'
  if (dayCount < 2) return 'sparse'
  return 'ready'
}

export function buildPriceHistory(snapshots: PriceSnapshot[], stores: Store[]): PriceHistory {
  const relevant = snapshots.filter((snapshot) => isCadCurrency(snapshot.currency))
  const ordered = [...stores].sort((left, right) => left.name.localeCompare(right.name))
  const ids = [...new Set(relevant.map((snapshot) => snapshot.store_id ?? 'unknown'))]
  const days = [...new Set(relevant.map((snapshot) => dayKey(snapshot.captured_at)).filter(Boolean))].sort()
  const rows = days.map((day) => {
    const row: Record<string, string | number | null> = { date: day }
    for (const id of ids) row[id] = null
    for (const snapshot of relevant) {
      if (dayKey(snapshot.captured_at) !== day) continue
      const id = snapshot.store_id ?? 'unknown'
      const current = row[id]
      if (typeof current !== 'number' || snapshot.price < current) row[id] = snapshot.price
    }
    return row
  })
  const series = ids.map((id) => {
    const index = ordered.findIndex((store) => store.id === id)
    const name = id === 'unknown' ? 'Unknown store' : (ordered.find((store) => store.id === id)?.name ?? 'Unknown store')
    return { id, name, color: seriesColor(index) }
  })
  return { rows, series }
}
