import { categoryKey, toCents } from './format'
import { priorityRank } from './labels'
import { pickOpenDeal } from './deals'
import { isQualifying } from './offers'
import { offerSeriesKey } from './identity'
import { cheapestEver, chooseBest, offerQuotes, sparklineValues } from './quotes'
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
  other: Quote[]
  best: Quote | null
  allTimeLow: number | null
  atLow: boolean
  spark: number[]
  openDeal: Deal | null
  targetGap: number | null
}

export function buildWatchRows(data: Dataset, now = new Date()): WatchRow[] {
  const quotesByItem = quotesFor(data, (snapshot) => isQualifying(snapshot))
  const otherByItem = quotesFor(data, (snapshot) => !isQualifying(snapshot))
  const dealsByItem = new Map<string, Deal[]>()
  for (const deal of data.deals) {
    const list = dealsByItem.get(deal.item_id) ?? []
    list.push(deal)
    dealsByItem.set(deal.item_id, list)
  }
  const qualifyingByItem = new Map<string, Dataset['snapshots']>()
  for (const snapshot of data.snapshots) {
    if (!isQualifying(snapshot)) continue
    const list = qualifyingByItem.get(snapshot.item_id) ?? []
    list.push(snapshot)
    qualifyingByItem.set(snapshot.item_id, list)
  }

  return data.items.map((item) => {
    const quotes = sortQuotes(quotesByItem.get(item.id) ?? [])
    const other = sortQuotes(otherByItem.get(item.id) ?? [])
    const best = chooseBest(quotes)
    const ever = cheapestEver(qualifyingByItem.get(item.id) ?? [])
    const low = ever && !ever.outOfStock ? ever.snapshot : null
    const atLow = best != null && best.inStock !== false && low != null && toCents(best.price) <= toCents(low.price)
    const targetGap = best && item.target_price != null ? best.price - item.target_price : null
    return {
      item,
      quotes,
      other,
      best,
      allTimeLow: low?.price ?? null,
      atLow,
      spark: sparklineValues(seriesSnapshots(qualifyingByItem.get(item.id) ?? [], best?.snapshotId ?? null), now),
      openDeal: pickOpenDeal(dealsByItem.get(item.id) ?? []),
      targetGap,
    }
  })
}

function seriesSnapshots(snapshots: Dataset['snapshots'], snapshotId: number | null): Dataset['snapshots'] {
  if (snapshotId == null) return []
  const current = snapshots.find((snapshot) => snapshot.id === snapshotId)
  if (!current) return []
  const key = offerSeriesKey(current)
  return snapshots.filter((snapshot) => offerSeriesKey(snapshot) === key)
}

function quotesFor(data: Dataset, include: (snapshot: Dataset['snapshots'][number]) => boolean): Map<string, Quote[]> {
  const quotesByItem = new Map<string, Quote[]>()
  for (const quote of offerQuotes(data.snapshots.filter(include), data.stores)) {
    const list = quotesByItem.get(quote.itemId) ?? []
    list.push(quote)
    quotesByItem.set(quote.itemId, list)
  }
  return quotesByItem
}

function sortQuotes(quotes: Quote[]): Quote[] {
  return [...quotes].sort((left, right) => left.price - right.price || left.storeName.localeCompare(right.storeName))
}

function haystack(item: Item): string {
  return [item.name, item.public_summary, item.product_url, item.description, item.category, item.notes, item.condition, ...item.keywords]
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
