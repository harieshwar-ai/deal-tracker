import { dayKey, isCadCurrency, toCents } from './format'
import type { PriceSnapshot, Store } from './types'

export interface Quote {
  snapshotId: number
  itemId: string
  storeId: string | null
  storeName: string
  price: number
  regularPrice: number | null
  currency: string
  inStock: boolean | null
  memberOnly: boolean | null
  capturedAt: string
  productTitle: string | null
  productName: string | null
  productUrl: string | null
  saleEndsAt: string | null
  shipping: number | null
  meetsRequirements: boolean | null
}

export function storeName(stores: Store[], storeId: string | null): string {
  if (!storeId) return 'Unknown store'
  return stores.find((store) => store.id === storeId)?.name ?? 'Unknown store'
}

export function capturedTime(iso: string): number {
  const time = Date.parse(iso)
  return Number.isNaN(time) ? 0 : time
}

export function quoteFromSnapshot(snapshot: PriceSnapshot, stores: Store[]): Quote {
  return {
    snapshotId: snapshot.id,
    itemId: snapshot.item_id,
    storeId: snapshot.store_id,
    storeName: storeName(stores, snapshot.store_id),
    price: snapshot.price,
    regularPrice: snapshot.regular_price,
    currency: snapshot.currency,
    inStock: snapshot.in_stock,
    memberOnly: snapshot.member_only,
    capturedAt: snapshot.captured_at,
    productTitle: snapshot.product_title,
    productName: snapshot.product_name,
    productUrl: snapshot.product_url,
    saleEndsAt: snapshot.sale_ends_at,
    shipping: snapshot.shipping,
    meetsRequirements: snapshot.meets_requirements,
  }
}

function isNewer(candidate: PriceSnapshot, current: PriceSnapshot): boolean {
  const candidateTime = capturedTime(candidate.captured_at)
  const currentTime = capturedTime(current.captured_at)
  if (candidateTime !== currentTime) return candidateTime > currentTime
  return candidate.id > current.id
}

export function latestSnapshots(snapshots: PriceSnapshot[]): PriceSnapshot[] {
  return latestBy(snapshots, (snapshot) => `${snapshot.item_id}\u0000${snapshot.store_id ?? ''}`)
}

export function latestOffers(snapshots: PriceSnapshot[]): PriceSnapshot[] {
  return latestBy(snapshots, (snapshot) => {
    const product = (snapshot.product_name || '').trim().toLowerCase()
    return `${snapshot.item_id}\u0000${snapshot.store_id ?? ''}\u0000${product}`
  })
}

function latestBy(snapshots: PriceSnapshot[], keyFor: (snapshot: PriceSnapshot) => string): PriceSnapshot[] {
  const winners = new Map<string, PriceSnapshot>()
  for (const snapshot of snapshots) {
    const key = keyFor(snapshot)
    const current = winners.get(key)
    if (!current || isNewer(snapshot, current)) winners.set(key, snapshot)
  }
  return [...winners.values()]
}

export function chooseBest(quotes: Quote[]): Quote | null {
  if (quotes.length === 0) return null
  const cad = quotes.filter((quote) => isCadCurrency(quote.currency))
  const pool = cad.length > 0 ? cad : quotes
  const purchasable = pool.filter((quote) => quote.inStock !== false)
  const candidates = purchasable.length > 0 ? purchasable : pool
  const sorted = [...candidates].sort(
    (left, right) => left.price - right.price || left.storeName.localeCompare(right.storeName),
  )
  return sorted[0] ?? null
}

export function allTimeLow(snapshots: PriceSnapshot[]): PriceSnapshot | null {
  let best: PriceSnapshot | null = null
  for (const snapshot of snapshots) {
    if (!isCadCurrency(snapshot.currency)) continue
    if (!best) {
      best = snapshot
      continue
    }
    const priceDelta = toCents(snapshot.price) - toCents(best.price)
    if (priceDelta < 0) {
      best = snapshot
      continue
    }
    if (priceDelta === 0) {
      const timeDelta = capturedTime(snapshot.captured_at) - capturedTime(best.captured_at)
      if (timeDelta < 0 || (timeDelta === 0 && snapshot.id < best.id)) best = snapshot
    }
  }
  return best
}

export function sparklineValues(snapshots: PriceSnapshot[], now = new Date(), days = 45): number[] {
  const start = now.getTime() - days * 86400000
  const byDay = new Map<string, number>()
  for (const snapshot of snapshots) {
    if (!isCadCurrency(snapshot.currency)) continue
    const time = capturedTime(snapshot.captured_at)
    if (time < start) continue
    const day = dayKey(snapshot.captured_at)
    if (!day) continue
    const current = byDay.get(day)
    if (current == null || snapshot.price < current) byDay.set(day, snapshot.price)
  }
  return [...byDay.entries()].sort((left, right) => left[0].localeCompare(right[0])).map((entry) => entry[1])
}
