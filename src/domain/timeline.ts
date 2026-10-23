import { isCadCurrency, toCents } from './format'
import { assignProducts } from './identity'
import { storeName } from './quotes'
import type { Dataset, PriceSnapshot } from './types'

export type TimelineKind = 'drop' | 'raise' | 'restock' | 'out_of_stock' | 'new_low'

export interface TimelineEvent {
  id: string
  itemId: string
  itemName: string
  storeName: string
  productName: string | null
  kind: TimelineKind
  at: string
  price: number | null
  previousPrice: number | null
}

export function timelineLabel(kind: TimelineKind): string {
  switch (kind) {
    case 'drop':
      return 'Price drop'
    case 'raise':
      return 'Price rise'
    case 'restock':
      return 'Back in stock'
    case 'out_of_stock':
      return 'Out of stock'
    case 'new_low':
      return 'New low'
    default: {
      const neverKind: never = kind
      return neverKind
    }
  }
}

export function buildTimeline(data: Dataset): TimelineEvent[] {
  const names = new Map(data.items.map((item) => [item.id, item.name]))
  const grouped = new Map<string, PriceSnapshot[]>()
  for (const snapshot of data.snapshots) {
    const list = grouped.get(snapshot.item_id) ?? []
    list.push(snapshot)
    grouped.set(snapshot.item_id, list)
  }

  const events: TimelineEvent[] = []
  for (const [itemId, snapshots] of grouped) {
    const assignments = assignProducts(snapshots)
    const ordered = [...snapshots].sort(byTime)
    let low: number | null = null
    const previous = new Map<string, PriceSnapshot>()
    for (const snapshot of ordered) {
      const assigned = assignments.get(snapshot.id)
      const track = `${snapshot.store_id ?? ''}\u0000${assigned?.productKey ?? ''}`
      const prior = previous.get(track)
      const productName = eventProductName(snapshot.product_name, assigned?.displayName ?? null, assigned?.optionLabel ?? null, assigned?.multiVariant ?? false)
      const cad = isCadCurrency(snapshot.currency)
      const cents = toCents(snapshot.price)
      const priorCents = prior && isCadCurrency(prior.currency) ? toCents(prior.price) : null
      if (cad && low != null && cents < low) {
        events.push(makeEvent(snapshot, 'new_low', names.get(itemId) ?? 'Item', data, priorCents == null ? null : prior?.price ?? null, productName))
      } else if (cad && priorCents != null && cents < priorCents) {
        events.push(makeEvent(snapshot, 'drop', names.get(itemId) ?? 'Item', data, prior?.price ?? null, productName))
      } else if (cad && priorCents != null && cents > priorCents) {
        events.push(makeEvent(snapshot, 'raise', names.get(itemId) ?? 'Item', data, prior?.price ?? null, productName))
      }
      if (prior && prior.in_stock === false && snapshot.in_stock === true) {
        events.push(makeEvent(snapshot, 'restock', names.get(itemId) ?? 'Item', data, null, productName))
      }
      if (prior && prior.in_stock !== false && snapshot.in_stock === false) {
        events.push(makeEvent(snapshot, 'out_of_stock', names.get(itemId) ?? 'Item', data, null, productName))
      }
      if (cad && (low == null || cents < low)) low = cents
      previous.set(track, snapshot)
    }
  }

  return events.sort((left, right) => {
    const time = Date.parse(right.at) - Date.parse(left.at)
    if (time !== 0) return time
    return left.itemName.localeCompare(right.itemName) || left.kind.localeCompare(right.kind)
  })
}

function eventProductName(productName: string | null, displayName: string | null, optionLabel: string | null, multiVariant: boolean): string | null {
  if (!multiVariant) return productName
  const name = displayName || productName
  if (!name) return optionLabel
  return optionLabel ? `${name} · ${optionLabel}` : name
}

function makeEvent(
  snapshot: PriceSnapshot,
  kind: TimelineKind,
  itemName: string,
  data: Dataset,
  previousPrice: number | null,
  productName: string | null,
): TimelineEvent {
  return {
    id: `${snapshot.id}:${kind}`,
    itemId: snapshot.item_id,
    itemName,
    storeName: storeName(data.stores, snapshot.store_id),
    productName,
    kind,
    at: snapshot.captured_at,
    price: isCadCurrency(snapshot.currency) ? snapshot.price : null,
    previousPrice,
  }
}

function byTime(left: PriceSnapshot, right: PriceSnapshot): number {
  const time = Date.parse(left.captured_at) - Date.parse(right.captured_at)
  if (time !== 0 && !Number.isNaN(time)) return time
  return left.id - right.id
}
