import type { PriceSnapshot } from '../domain/types'
import { parseSnapshotRow } from './parse'

/**
 * Latest offers stay as real snapshot ids. One qualifying CAD low per store
 * per day is stored with a negative id so charts and all-time lows have a
 * series without a second current offer.
 */
export function snapshotsFromRollup(latestRows: unknown[], dailyRows: unknown[]): PriceSnapshot[] {
  const latest = latestRows.map((row) => parseSnapshotRow(row))
  const names = singleProductName(latest)
  const daily: PriceSnapshot[] = []
  let nextId = -1
  for (const row of dailyRows) {
    const built = dailySnapshot(row, nextId, names)
    if (!built) continue
    daily.push(built)
    nextId -= 1
  }
  return [...latest, ...daily]
}

function singleProductName(latest: PriceSnapshot[]): Map<string, string> {
  const names = new Map<string, Set<string>>()
  for (const snapshot of latest) {
    if (!snapshot.product_name) continue
    const key = offerKey(snapshot.item_id, snapshot.store_id)
    const set = names.get(key) ?? new Set<string>()
    set.add(snapshot.product_name)
    names.set(key, set)
  }
  const single = new Map<string, string>()
  for (const [key, set] of names) {
    if (set.size === 1) {
      const name = [...set][0]
      if (name) single.set(key, name)
    }
  }
  return single
}

function dailySnapshot(row: unknown, id: number, names: Map<string, string>): PriceSnapshot | null {
  if (!row || typeof row !== 'object') return null
  const record = row as Record<string, unknown>
  const itemId = typeof record.item_id === 'string' ? record.item_id : ''
  const day = typeof record.day === 'string' ? record.day.slice(0, 10) : ''
  const price = numberOrNull(record.qualifying_low)
  if (!itemId || !/^\d{4}-\d{2}-\d{2}$/.test(day) || price == null) return null
  const storeId = typeof record.store_id === 'string' ? record.store_id : null
  return {
    id,
    item_id: itemId,
    store_id: storeId,
    product_title: null,
    product_url: null,
    price,
    regular_price: null,
    currency: 'CAD',
    in_stock: true,
    member_only: null,
    captured_at: `${day}T04:00:00.000Z`,
    sale_ends_at: null,
    shipping: null,
    product_name: names.get(offerKey(itemId, storeId)) ?? null,
    meets_requirements: true,
  }
}

function offerKey(itemId: string, storeId: string | null): string {
  return `${itemId}\u0000${storeId ?? ''}`
}

function numberOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}
