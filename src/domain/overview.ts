import { typicalPrice } from './context'
import { clusterDeals } from './deals'
import type { DealCluster } from './deals'
import { dayKey, isCadCurrency } from './format'
import { heroStats } from './hero'
import { assignProducts, offerSeriesKey } from './identity'
import { categoryLabel } from './labels'
import { isQualifying } from './offers'
import { storeName } from './quotes'
import { buildTimeline } from './timeline'
import type { TimelineEvent } from './timeline'
import type { Dataset, Deal, PriceSnapshot } from './types'
import type { PriceCall } from './verdict'
import { watchCategories } from './watchlist'

export interface DropHighlight {
  itemId: string
  itemName: string
  storeName: string
  amount: number
  percent: number
  at: string
}

export interface BestDealRow {
  id: string
  itemId: string
  name: string
  productName: string
  price: number
  storeName: string
  call: PriceCall
  versus: string | null
}

export interface CategoryTile {
  category: string
  label: string
  items: number
  goodDeals: number
}

export interface MarketOverview {
  watched: number
  openGoodDeals: number
  biggestDrop: DropHighlight | null
  lastScan: string | null
  bestDeals: BestDealRow[]
  categories: CategoryTile[]
  changes: TimelineEvent[]
}

const callRank: Record<PriceCall, number> = { buy: 0, good: 1, wait: 2 }
const weekMs = 7 * 24 * 60 * 60 * 1000
const bestDealLimit = 8

export function openGoodDeals(data: Dataset): DealCluster[] {
  return clusterDeals(data.deals.filter((deal) => deal.status === 'open'), data.snapshots)
    .filter((cluster) => cluster.deal.verdict === 'must_buy' || cluster.deal.verdict === 'good')
}

export function marketOverview(data: Dataset, includeTarget: boolean, now = new Date()): MarketOverview {
  const hero = heroStats(data, includeTarget, now)
  const good = openGoodDeals(data)
  const goodByItem = new Map<string, number>()
  for (const cluster of good) goodByItem.set(cluster.deal.item_id, (goodByItem.get(cluster.deal.item_id) ?? 0) + 1)
  const events = buildTimeline(data)
  const categories = watchCategories(data.items).filter((category) => category !== 'Uncategorized')
  return {
    watched: data.items.filter((item) => item.active).length,
    openGoodDeals: good.length,
    biggestDrop: biggestDropThisWeek(data, now),
    lastScan: hero.lastScan,
    bestDeals: bestDealsNow(data, good, now),
    categories: categories.map((category) => ({
      category,
      label: categoryLabel(category),
      items: data.items.filter((item) => item.active && item.category === category).length,
      goodDeals: data.items
        .filter((item) => item.category === category)
        .reduce((sum, item) => sum + (goodByItem.get(item.id) ?? 0), 0),
    })),
    changes: recentChanges(events, 8),
  }
}

export function biggestDropThisWeek(data: Dataset, now = new Date()): DropHighlight | null {
  const cutoff = now.getTime() - weekMs
  const names = new Map(data.items.map((item) => [item.id, item.name]))
  let best: DropHighlight | null = null
  const byItem = new Map<string, PriceSnapshot[]>()
  for (const snapshot of data.snapshots) {
    const list = byItem.get(snapshot.item_id) ?? []
    list.push(snapshot)
    byItem.set(snapshot.item_id, list)
  }
  for (const [itemId, snapshots] of byItem) {
    const assignments = assignProducts(snapshots)
    const groups = new Map<string, PriceSnapshot[]>()
    for (const snapshot of snapshots) {
      if (!countsAsDrop(snapshot)) continue
      const product = assignments.get(snapshot.id)?.productKey ?? `listing:${snapshot.id}`
      const key = `${snapshot.store_id ?? ''}\u0000${product}`
      const list = groups.get(key) ?? []
      list.push(snapshot)
      groups.set(key, list)
    }
    for (const series of groups.values()) {
      const days = dailyLows(series)
      for (let index = 1; index < days.length; index += 1) {
        const current = days[index]
        const previous = days[index - 1]
        if (!current || !previous) continue
        const at = Date.parse(current.at)
        if (Number.isNaN(at) || at < cutoff || at > now.getTime()) continue
        const amount = previous.price - current.price
        if (amount <= 0 || previous.price <= 0) continue
        if (!best || amount > best.amount) {
          const sample = series[0]
          best = {
            itemId,
            itemName: names.get(itemId) ?? 'Item',
            storeName: storeName(data.stores, sample?.store_id ?? null),
            amount,
            percent: (amount / previous.price) * 100,
            at: current.at,
          }
        }
      }
    }
  }
  return best
}

function bestDealsNow(data: Dataset, good: DealCluster[], now: Date): BestDealRow[] {
  const rows: BestDealRow[] = []
  const snapshotsByItem = new Map<string, PriceSnapshot[]>()
  for (const snapshot of data.snapshots) {
    const list = snapshotsByItem.get(snapshot.item_id) ?? []
    list.push(snapshot)
    snapshotsByItem.set(snapshot.item_id, list)
  }
  const assignmentsByItem = new Map<string, ReturnType<typeof assignProducts>>()
  const typicalByProduct = new Map<string, number | null>()
  for (const cluster of good) {
    const deal = cluster.deal
    const item = data.items.find((entry) => entry.id === deal.item_id)
    if (!item?.active) continue
    const snapshots = snapshotsByItem.get(item.id) ?? []
    let assignments = assignmentsByItem.get(item.id)
    if (!assignments) {
      assignments = assignProducts(snapshots)
      assignmentsByItem.set(item.id, assignments)
    }
    const offer = latestStockedOffer(deal, snapshots, assignments)
    if (!offer) continue
    const assigned = assignments.get(offer.id)
    const productKey = assigned?.productKey ?? `listing:${offer.id}`
    const typicalKey = `${item.id}\u0000${productKey}`
    let typical = typicalByProduct.get(typicalKey)
    if (typical === undefined) {
      const series = assigned
        ? snapshots.filter((snapshot) => assignments?.get(snapshot.id)?.productKey === productKey)
        : snapshots
      typical = typicalPrice(series, now)
      typicalByProduct.set(typicalKey, typical)
    }
    rows.push({
      id: deal.id,
      itemId: item.id,
      name: item.name,
      productName: assigned?.displayName || offer.product_name || item.name,
      price: offer.price,
      storeName: storeName(data.stores, offer.store_id),
      call: deal.verdict === 'must_buy' ? 'buy' : 'good',
      versus: typical == null ? null : versusTypical(offer.price, typical),
    })
  }
  rows.sort((left, right) => (
    callRank[left.call] - callRank[right.call]
    || belowRank(right.versus) - belowRank(left.versus)
    || left.price - right.price
    || left.productName.localeCompare(right.productName)
  ))
  return spreadBestDeals(rows, bestDealLimit)
}

/** One row per watched item first, so one product family cannot fill the list. */
function spreadBestDeals(rows: BestDealRow[], limit: number): BestDealRow[] {
  const picked: BestDealRow[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    if (seen.has(row.itemId)) continue
    seen.add(row.itemId)
    picked.push(row)
    if (picked.length >= limit) return picked
  }
  for (const row of rows) {
    if (picked.some((entry) => entry.id === row.id)) continue
    picked.push(row)
    if (picked.length >= limit) break
  }
  return picked
}

function latestStockedOffer(
  deal: Deal,
  snapshots: PriceSnapshot[],
  assignments: ReturnType<typeof assignProducts>,
): PriceSnapshot | null {
  const atStore = snapshots.filter((snapshot) => (
    snapshot.item_id === deal.item_id && (snapshot.store_id ?? null) === (deal.store_id ?? null)
  ))
  const linked = deal.snapshot_id != null ? atStore.find((snapshot) => snapshot.id === deal.snapshot_id) : undefined
  const productKey = linked ? assignments.get(linked.id)?.productKey : null
  const pool = productKey
    ? atStore.filter((snapshot) => assignments.get(snapshot.id)?.productKey === productKey)
    : atStore
  const latestBySeries = new Map<string, PriceSnapshot>()
  for (const snapshot of pool) {
    const key = offerSeriesKey(snapshot)
    const current = latestBySeries.get(key)
    if (!current || laterSnapshot(snapshot, current)) latestBySeries.set(key, snapshot)
  }
  const stocked = [...latestBySeries.values()].filter(countsAsDrop)
  stocked.sort((left, right) => left.price - right.price || right.id - left.id)
  return stocked[0] ?? null
}

function laterSnapshot(candidate: PriceSnapshot, current: PriceSnapshot): boolean {
  const time = Date.parse(candidate.captured_at) - Date.parse(current.captured_at)
  if (time !== 0 && !Number.isNaN(time)) return time > 0
  return candidate.id > current.id
}

function countsAsDrop(snapshot: PriceSnapshot): boolean {
  return isQualifying(snapshot) && snapshot.in_stock !== false && isCadCurrency(snapshot.currency)
}

function dailyLows(series: PriceSnapshot[]): { price: number; at: string }[] {
  const byDay = new Map<string, { price: number; at: string }>()
  for (const snapshot of series) {
    const day = dayKey(snapshot.captured_at)
    if (!day) continue
    const current = byDay.get(day)
    if (!current || snapshot.price < current.price) byDay.set(day, { price: snapshot.price, at: snapshot.captured_at })
  }
  return [...byDay.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map((entry) => entry[1])
}

function belowRank(versus: string | null): number {
  if (!versus) return Number.NEGATIVE_INFINITY
  const below = versus.match(/^(\d+)% below typical$/)
  if (below) return Number(below[1])
  const above = versus.match(/^(\d+)% above typical$/)
  if (above) return -Number(above[1])
  return 0
}

/** Latest change per item, store, and variant. */
export function recentChanges(events: TimelineEvent[], limit: number): TimelineEvent[] {
  const seen = new Set<string>()
  const out: TimelineEvent[] = []
  const ordered = [...events].sort((left, right) => right.at.localeCompare(left.at) || right.id.localeCompare(left.id))
  for (const event of ordered) {
    const key = variantKey(event)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(event)
    if (out.length >= limit) break
  }
  return out
}

export function versusTypical(current: number | null, median: number | null): string {
  if (current == null || median == null || median <= 0) return '—'
  const delta = (current - median) / median
  if (Math.abs(delta) < 0.005) return 'At typical'
  const pct = Math.round(Math.abs(delta) * 100)
  return delta < 0 ? `${pct}% below typical` : `${pct}% above typical`
}

function variantKey(event: TimelineEvent): string {
  return `${event.itemId}\u0000${event.storeName}\u0000${event.productName ?? ''}`
}
