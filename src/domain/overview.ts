import { clusterDeals } from './deals'
import { heroStats } from './hero'
import { categoryLabel } from './labels'
import { buildTimeline } from './timeline'
import type { TimelineEvent } from './timeline'
import type { Dataset } from './types'
import { priceCallsForDataset } from './verdict'
import type { PriceCall } from './verdict'
import { buildWatchRows, watchCategories } from './watchlist'

export interface DropHighlight {
  itemId: string
  itemName: string
  storeName: string
  amount: number
  at: string
}

export interface BestDealRow {
  itemId: string
  name: string
  price: number
  storeName: string
  call: PriceCall
  category: string | null
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

export function marketOverview(data: Dataset, includeTarget: boolean, now = new Date()): MarketOverview {
  const hero = heroStats(data, includeTarget, now)
  const calls = priceCallsForDataset(data, includeTarget, now)
  const rows = buildWatchRows(data, now)
  const open = clusterDeals(data.deals.filter((deal) => deal.status === 'open'), data.snapshots)
  const good = open.filter((cluster) => cluster.deal.verdict === 'must_buy' || cluster.deal.verdict === 'good')
  const goodByItem = new Map<string, number>()
  for (const cluster of good) goodByItem.set(cluster.deal.item_id, (goodByItem.get(cluster.deal.item_id) ?? 0) + 1)
  const events = buildTimeline(data)
  const categories = watchCategories(data.items).filter((category) => category !== 'Uncategorized')
  const bestDeals: BestDealRow[] = []
  for (const row of rows) {
    const call = calls.get(row.item.id)
    if (!row.best || !call || call.call === 'wait' || !row.item.active || row.best.inStock === false) continue
    bestDeals.push({
      itemId: row.item.id,
      name: row.item.name,
      price: row.best.price,
      storeName: row.best.storeName,
      call: call.call,
      category: row.item.category,
    })
  }
  bestDeals.sort((left, right) => callRank[left.call] - callRank[right.call] || left.price - right.price)
  return {
    watched: data.items.filter((item) => item.active).length,
    openGoodDeals: good.length,
    biggestDrop: biggestDropThisWeek(events, now),
    lastScan: hero.lastScan,
    bestDeals: bestDeals.slice(0, 5),
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

export function biggestDropThisWeek(events: TimelineEvent[], now = new Date()): DropHighlight | null {
  const cutoff = now.getTime() - weekMs
  let best: DropHighlight | null = null
  const seen = new Set<string>()
  const ordered = [...events].sort((left, right) => right.at.localeCompare(left.at) || right.id.localeCompare(left.id))
  for (const event of ordered) {
    if (event.kind !== 'drop' && event.kind !== 'new_low') continue
    const at = Date.parse(event.at)
    if (Number.isNaN(at) || at < cutoff) continue
    if (event.price == null || event.previousPrice == null) continue
    const amount = event.previousPrice - event.price
    if (amount <= 0) continue
    const key = variantKey(event)
    if (seen.has(key)) continue
    seen.add(key)
    if (!best || amount > best.amount) {
      best = {
        itemId: event.itemId,
        itemName: event.itemName,
        storeName: event.storeName,
        amount,
        at: event.at,
      }
    }
  }
  return best
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
