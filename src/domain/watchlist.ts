import { categoryKey, toCents } from './format'
import { priorityRank } from './labels'
import { pickOpenDeal } from './deals'
import { allTimeLow, chooseBest, latestSnapshots, quoteFromSnapshot, sparklineValues } from './quotes'
import type { Quote } from './quotes'
import type { ActivityFilter, Dataset, Deal, Item, Priority, WatchSort } from './types'

export interface WatchCriteria {
  query: string
  category: string | null
  priority: Priority | 'all'
  activity: ActivityFilter
  sort: WatchSort
}

export interface WatchRow {
  item: Item
  quotes: Quote[]
  best: Quote | null
  allTimeLow: number | null
  atLow: boolean
  spark: number[]
  openDeal: Deal | null
  targetGap: number | null
}

export function buildWatchRows(data: Dataset, now = new Date()): WatchRow[] {
  const latest = latestSnapshots(data.snapshots)
  const quotesByItem = new Map<string, Quote[]>()
  for (const snapshot of latest) {
    const quote = quoteFromSnapshot(snapshot, data.stores)
    const list = quotesByItem.get(quote.itemId) ?? []
    list.push(quote)
    quotesByItem.set(quote.itemId, list)
  }
  const dealsByItem = new Map<string, Deal[]>()
  for (const deal of data.deals) {
    const list = dealsByItem.get(deal.item_id) ?? []
    list.push(deal)
    dealsByItem.set(deal.item_id, list)
  }
  const snapshotsByItem = new Map<string, Dataset['snapshots']>()
  for (const snapshot of data.snapshots) {
    const list = snapshotsByItem.get(snapshot.item_id) ?? []
    list.push(snapshot)
    snapshotsByItem.set(snapshot.item_id, list)
  }

  return data.items.map((item) => {
    const quotes = [...(quotesByItem.get(item.id) ?? [])].sort(
      (left, right) => left.price - right.price || left.storeName.localeCompare(right.storeName),
    )
    const best = chooseBest(quotes)
    const low = allTimeLow(snapshotsByItem.get(item.id) ?? [])
    const atLow = best != null && low != null && toCents(best.price) <= toCents(low.price)
    const targetGap = best && item.target_price != null ? best.price - item.target_price : null
    return {
      item,
      quotes,
      best,
      allTimeLow: low?.price ?? null,
      atLow,
      spark: sparklineValues(snapshotsByItem.get(item.id) ?? [], now),
      openDeal: pickOpenDeal(dealsByItem.get(item.id) ?? []),
      targetGap,
    }
  })
}

function haystack(item: Item): string {
  return [item.name, item.description, item.category, item.notes, item.condition, ...item.keywords]
    .filter((part): part is string => Boolean(part))
    .join(' ')
    .toLowerCase()
}

export function filterWatchRows(rows: WatchRow[], criteria: WatchCriteria): WatchRow[] {
  const tokens = criteria.query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  return rows.filter((row) => {
    if (criteria.activity === 'active' && !row.item.active) return false
    if (criteria.activity === 'paused' && row.item.active) return false
    if (criteria.priority !== 'all' && row.item.priority !== criteria.priority) return false
    if (criteria.category && categoryKey(row.item.category) !== criteria.category) return false
    if (tokens.length === 0) return true
    const text = haystack(row.item)
    return tokens.every((token) => text.includes(token))
  })
}

export function sortWatchRows(rows: WatchRow[], sort: WatchSort): WatchRow[] {
  const copy = [...rows]
  copy.sort((left, right) => compareRows(left, right, sort))
  return copy
}

function compareRows(left: WatchRow, right: WatchRow, sort: WatchSort): number {
  switch (sort) {
    case 'target_gap':
      return compareNullable(left.targetGap, right.targetGap) || left.item.name.localeCompare(right.item.name)
    case 'price_asc':
      return (
        compareNullable(left.best?.price ?? null, right.best?.price ?? null) ||
        left.item.name.localeCompare(right.item.name)
      )
    case 'priority':
      return (
        priorityRank(left.item.priority) - priorityRank(right.item.priority) ||
        left.item.name.localeCompare(right.item.name)
      )
    case 'name':
      return left.item.name.localeCompare(right.item.name)
    case 'updated':
      return right.item.updated_at.localeCompare(left.item.updated_at) || left.item.name.localeCompare(right.item.name)
    default: {
      const neverSort: never = sort
      return neverSort
    }
  }
}

function compareNullable(left: number | null, right: number | null): number {
  if (left == null && right == null) return 0
  if (left == null) return 1
  if (right == null) return -1
  return left - right
}

export function watchCategories(items: Item[]): string[] {
  return [...new Set(items.map((item) => categoryKey(item.category)))].sort((left, right) =>
    left.localeCompare(right),
  )
}
