import { dayKey, isCadCurrency } from './format'
import { assignProducts } from './identity'
import type { ProductAssignment } from './identity'
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
  const assignments = assignProducts(relevant)
  const ordered = [...stores].sort((left, right) => left.name.localeCompare(right.name))
  const ids = [...new Set(relevant.map((snapshot) => seriesId(snapshot, assignments.get(snapshot.id))))]
  const newest = new Map<string, PriceSnapshot>()
  for (const snapshot of relevant) {
    const id = seriesId(snapshot, assignments.get(snapshot.id))
    const current = newest.get(id)
    if (!current || snapshot.captured_at > current.captured_at || (snapshot.captured_at === current.captured_at && snapshot.id > current.id)) {
      newest.set(id, snapshot)
    }
  }
  const days = [...new Set(relevant.map((snapshot) => dayKey(snapshot.captured_at)).filter(Boolean))].sort()
  const rows = days.map((day) => {
    const row: Record<string, string | number | null> = { date: day }
    for (const id of ids) row[id] = null
    for (const snapshot of relevant) {
      if (dayKey(snapshot.captured_at) !== day) continue
      const id = seriesId(snapshot, assignments.get(snapshot.id))
      const current = row[id]
      if (typeof current !== 'number' || snapshot.price < current) row[id] = snapshot.price
    }
    return row
  })
  const series = ids.map((id, index) => {
    const sample = newest.get(id)
    const storeId = sample?.store_id ?? id.split('::')[0] ?? 'unknown'
    const storeIndex = ordered.findIndex((store) => store.id === storeId)
    const assignment = sample ? assignments.get(sample.id) : undefined
    return { id, name: seriesName(storeId, sample, assignment, stores), color: seriesColor(storeIndex >= 0 ? storeIndex : index) }
  })
  return { rows, series }
}

function seriesId(snapshot: PriceSnapshot, assignment: ProductAssignment | undefined): string {
  const storeId = snapshot.store_id ?? 'unknown'
  if (!assignment || assignment.unnamed) return storeId
  return `${storeId}::${assignment.productKey}`
}

function seriesName(storeId: string, snapshot: PriceSnapshot | undefined, assignment: ProductAssignment | undefined, stores: Store[]): string {
  const name = storeId === 'unknown' ? 'Unknown store' : (stores.find((store) => store.id === storeId)?.name ?? 'Unknown store')
  if (!assignment || assignment.unnamed) return name
  const product = assignment.multiVariant ? assignment.displayName : snapshot?.product_name
  return product ? `${name} · ${product}` : name
}
