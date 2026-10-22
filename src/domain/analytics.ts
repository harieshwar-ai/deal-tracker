import { categoryKey, dayKey, isCadCurrency, roundMoney, toCents } from './format'
import { periodPhrase } from './labels'
import { verdictGroup } from './deals'
import { allTimeLow, chooseBest, latestSnapshots, quoteFromSnapshot, storeName } from './quotes'
import type { Quote } from './quotes'
import type { Dataset, DatePreset, Deal, DealStatus, Item, PriceSnapshot, Store } from './types'

export interface AnalyticsFilters {
  preset: DatePreset
  category: string | null
  storeId: string | null
  now?: Date
  includeTargets?: boolean
}

export interface IndexedPoint {
  date: string
  index: number
}

export interface SavingsPoint {
  date: string
  savings: number
}

export interface StoreStat {
  storeId: string
  storeName: string
  enabled: boolean
  wins: number
  observations: number
  avgDiscountPct: number | null
}

export interface StoreIndexSeries {
  storeId: string
  storeName: string
  points: { date: string; index: number | null }[]
}

export interface DealFlowPoint {
  date: string
  must_buy: number
  good: number
  ok: number
  skip: number
  unrated: number
}

export interface ScoreBucket {
  label: string
  count: number
}

export interface CategoryStat {
  category: string
  items: number
  openDeals: number
  underTarget: number
  avgDiscountPct: number | null
}

export interface AtlRow {
  itemId: string
  itemName: string
  category: string | null
  atlPrice: number
  atlAt: string
  atlStoreName: string
  currentPrice: number | null
  currentStoreName: string | null
  currentAt: string | null
  atLow: boolean
  gap: number | null
}

export interface AnalyticsModel {
  periodLabel: string
  itemCount: number
  activeItemCount: number
  pricedItemCount: number
  periodSnapshotCount: number
  historySnapshotCount: number
  excludedCurrencyCount: number
  underTargetCount: number
  underTargetSavings: number
  overTargetCount: number
  regularSavings: number
  openDealCount: number
  dealsInPeriod: number
  atLowCount: number
  itemDays: number
  priceIndex: IndexedPoint[]
  savingsByDate: SavingsPoint[]
  storeStats: StoreStat[]
  storeIndex: StoreIndexSeries[]
  dealFlow: DealFlowPoint[]
  dealFlowGrain: 'day' | 'week'
  scoreBuckets: ScoreBucket[]
  unscoredDeals: number
  categories: CategoryStat[]
  allTimeLows: AtlRow[]
  statusTotals: Record<DealStatus, number>
  insight: string
}

interface DayPrice {
  price: number
  regular: number | null
  storeId: string | null
  storeLabel: string
}

export function computeAnalytics(data: Dataset, filters: AnalyticsFilters): AnalyticsModel {
  const includeTargets = filters.includeTargets !== false
  const now = filters.now ?? new Date()
  const nowIso = now.toISOString()
  const start = rangeStart(filters.preset, now)
  const scopedItems = data.items.filter((item) => matchesCategory(item, filters.category))
  const itemIds = new Set(scopedItems.map((item) => item.id))
  const scopedSnapshots = data.snapshots.filter(
    (snapshot) => itemIds.has(snapshot.item_id) && matchesStore(snapshot.store_id, filters.storeId),
  )
  const history = scopedSnapshots.filter(
    (snapshot) => isCadCurrency(snapshot.currency) && inRange(snapshot.captured_at, null, nowIso),
  )
  const period = history.filter((snapshot) => inRange(snapshot.captured_at, start, nowIso))
  const excludedCurrencyCount = scopedSnapshots.filter(
    (snapshot) => !isCadCurrency(snapshot.currency) && inRange(snapshot.captured_at, start, nowIso),
  ).length
  const scopedDeals = data.deals.filter(
    (deal) => itemIds.has(deal.item_id) && matchesStore(deal.store_id, filters.storeId),
  )
  const periodDeals = scopedDeals.filter((deal) => inRange(deal.found_at, start, nowIso))
  const quotesByItem = quotesFromHistory(history, data.stores)
  const current = summarizeCurrent(scopedItems, quotesByItem, includeTargets)
  const { perItemDay, allDays } = dailyPrices(period, data.stores)
  const trend = buildTrend(scopedItems, perItemDay, allDays)
  const storeStats = buildStoreStats(data.stores, period, perItemDay, filters.storeId)
  const storeIndex = buildStoreIndex(period, allDays, data.stores)
  const dealFlowGrain = flowGrain(periodDeals)
  const dealFlow = buildDealFlow(periodDeals, dealFlowGrain)
  const allTimeLows = buildAtl(scopedItems, history, quotesByItem, data.stores)
  const categories = buildCategories(scopedItems, scopedDeals, quotesByItem, includeTargets)
  const statusTotals = emptyStatusTotals()
  for (const deal of periodDeals) statusTotals[deal.status] += 1

  const modelWithoutInsight = {
    periodLabel: periodPhrase(filters.preset),
    itemCount: scopedItems.length,
    activeItemCount: scopedItems.filter((item) => item.active).length,
    pricedItemCount: current.pricedItemCount,
    periodSnapshotCount: period.length,
    historySnapshotCount: history.length,
    excludedCurrencyCount,
    underTargetCount: current.underTargetCount,
    underTargetSavings: roundMoney(current.underTargetSavings),
    overTargetCount: current.overTargetCount,
    regularSavings: roundMoney(current.regularSavings),
    openDealCount: scopedDeals.filter((deal) => deal.status === 'open').length,
    dealsInPeriod: periodDeals.length,
    atLowCount: allTimeLows.filter((row) => row.atLow).length,
    itemDays: storeStats.reduce((sum, store) => sum + store.wins, 0),
    priceIndex: trend.priceIndex,
    savingsByDate: trend.savingsByDate,
    storeStats,
    storeIndex,
    dealFlow,
    dealFlowGrain,
    scoreBuckets: scoreBuckets(periodDeals),
    unscoredDeals: periodDeals.filter((deal) => deal.score == null).length,
    categories,
    allTimeLows,
    statusTotals,
  }
  return { ...modelWithoutInsight, insight: buildInsight(modelWithoutInsight, includeTargets) }
}

export function rangeStart(preset: DatePreset, now: Date): string | null {
  switch (preset) {
    case 'all':
      return null
    case '30d':
      return new Date(now.getTime() - 30 * 86400000).toISOString()
    case '90d':
      return new Date(now.getTime() - 90 * 86400000).toISOString()
    case '365d':
      return new Date(now.getTime() - 365 * 86400000).toISOString()
    default: {
      const neverPreset: never = preset
      return neverPreset
    }
  }
}

export function parsePreset(value: string | null): DatePreset {
  switch (value) {
    case '30d':
    case '90d':
    case '365d':
    case 'all':
      return value
    default:
      return '90d'
  }
}

function matchesCategory(item: Item, category: string | null): boolean {
  if (!category) return true
  return categoryKey(item.category) === category
}

function matchesStore(storeId: string | null, filter: string | null): boolean {
  if (!filter) return true
  return storeId === filter
}

function inRange(iso: string, start: string | null, end: string | null): boolean {
  const time = Date.parse(iso)
  if (Number.isNaN(time)) return false
  if (start && time < Date.parse(start)) return false
  if (end && time > Date.parse(end)) return false
  return true
}

function quotesFromHistory(history: PriceSnapshot[], stores: Store[]): Map<string, Quote[]> {
  const grouped = new Map<string, Quote[]>()
  for (const snapshot of latestSnapshots(history)) {
    const quote = quoteFromSnapshot(snapshot, stores)
    const list = grouped.get(quote.itemId) ?? []
    list.push(quote)
    grouped.set(quote.itemId, list)
  }
  return grouped
}

function summarizeCurrent(items: Item[], quotesByItem: Map<string, Quote[]>, includeTargets: boolean) {
  let pricedItemCount = 0
  let underTargetCount = 0
  let underTargetSavings = 0
  let overTargetCount = 0
  let regularSavings = 0
  for (const item of items) {
    const best = chooseBest(quotesByItem.get(item.id) ?? [])
    if (!best) continue
    pricedItemCount += 1
    if (includeTargets && item.target_price != null) {
      const gap = item.target_price - best.price
      if (gap > 0) {
        underTargetCount += 1
        underTargetSavings += gap
      } else if (gap < 0) {
        overTargetCount += 1
      }
    }
    if (best.regularPrice != null && best.regularPrice > best.price) {
      regularSavings += best.regularPrice - best.price
    }
  }
  return { pricedItemCount, underTargetCount, underTargetSavings, overTargetCount, regularSavings }
}

function dailyPrices(period: PriceSnapshot[], stores: Store[]) {
  const perItemDay = new Map<string, Map<string, DayPrice>>()
  for (const snapshot of period) {
    const day = dayKey(snapshot.captured_at)
    if (!day) continue
    let days = perItemDay.get(snapshot.item_id)
    if (!days) {
      days = new Map()
      perItemDay.set(snapshot.item_id, days)
    }
    const current = days.get(day)
    const label = storeName(stores, snapshot.store_id)
    if (!current || preferDayPrice(snapshot.price, label, current)) {
      days.set(day, {
        price: snapshot.price,
        regular: snapshot.regular_price,
        storeId: snapshot.store_id,
        storeLabel: label,
      })
    }
  }
  const allDays = [...new Set(period.map((snapshot) => dayKey(snapshot.captured_at)).filter(Boolean))].sort()
  return { perItemDay, allDays }
}

function preferDayPrice(price: number, label: string, current: DayPrice): boolean {
  if (price < current.price) return true
  if (price > current.price) return false
  return label.localeCompare(current.storeLabel) < 0
}

function buildTrend(
  items: Item[],
  perItemDay: Map<string, Map<string, DayPrice>>,
  allDays: string[],
) {
  const priceIndex: IndexedPoint[] = []
  const savingsByDate: SavingsPoint[] = []
  const state = new Map<string, { first: number; last: number; started: boolean }>()
  for (const day of allDays) {
    let indexSum = 0
    let indexCount = 0
    let savings = 0
    for (const item of items) {
      const observed = perItemDay.get(item.id)?.get(day)
      let itemState = state.get(item.id)
      if (observed) {
        if (!itemState) {
          itemState = { first: observed.price, last: observed.price, started: observed.price > 0 }
          state.set(item.id, itemState)
        } else {
          itemState.last = observed.price
        }
        if (observed.regular != null && observed.regular > observed.price) {
          savings += observed.regular - observed.price
        }
      }
      if (itemState?.started && itemState.first > 0) {
        indexSum += (itemState.last / itemState.first) * 100
        indexCount += 1
      }
    }
    if (indexCount > 0) priceIndex.push({ date: day, index: indexSum / indexCount })
    if (allDays.length > 0) savingsByDate.push({ date: day, savings: roundMoney(savings) })
  }
  return { priceIndex, savingsByDate }
}

function buildStoreStats(
  stores: Store[],
  period: PriceSnapshot[],
  perItemDay: Map<string, Map<string, DayPrice>>,
  storeFilter: string | null,
): StoreStat[] {
  const wins = new Map<string, number>()
  for (const days of perItemDay.values()) {
    for (const value of days.values()) {
      const key = value.storeId ?? 'unknown'
      wins.set(key, (wins.get(key) ?? 0) + 1)
    }
  }
  const observations = new Map<string, { count: number; discountSum: number; discountCount: number }>()
  for (const snapshot of period) {
    const key = snapshot.store_id ?? 'unknown'
    const bucket = observations.get(key) ?? { count: 0, discountSum: 0, discountCount: 0 }
    bucket.count += 1
    if (snapshot.regular_price != null && snapshot.regular_price > 0) {
      bucket.discountSum += ((snapshot.regular_price - snapshot.price) / snapshot.regular_price) * 100
      bucket.discountCount += 1
    }
    observations.set(key, bucket)
  }
  const ids = new Set<string>([...wins.keys(), ...observations.keys()])
  if (storeFilter) ids.add(storeFilter)
  else for (const store of stores) ids.add(store.id)

  return [...ids]
    .map((id) => {
      const store = stores.find((entry) => entry.id === id)
      const observed = observations.get(id)
      return {
        storeId: id,
        storeName: id === 'unknown' ? 'Unknown store' : (store?.name ?? 'Unknown store'),
        enabled: store?.enabled ?? false,
        wins: wins.get(id) ?? 0,
        observations: observed?.count ?? 0,
        avgDiscountPct: observed && observed.discountCount > 0 ? observed.discountSum / observed.discountCount : null,
      }
    })
    .sort((left, right) => right.wins - left.wins || left.storeName.localeCompare(right.storeName))
}

function buildStoreIndex(period: PriceSnapshot[], allDays: string[], stores: Store[]): StoreIndexSeries[] {
  const storeIds = [...new Set(period.map((snapshot) => snapshot.store_id ?? 'unknown'))]
  const series = storeIds.map((storeId) => {
    const mine = period.filter((snapshot) => (snapshot.store_id ?? 'unknown') === storeId)
    const byItem = new Map<string, Map<string, number>>()
    for (const snapshot of mine) {
      const day = dayKey(snapshot.captured_at)
      if (!day) continue
      const map = byItem.get(snapshot.item_id) ?? new Map<string, number>()
      const current = map.get(day)
      if (current == null || snapshot.price < current) map.set(day, snapshot.price)
      byItem.set(snapshot.item_id, map)
    }
    const state = new Map<string, { first: number; last: number }>()
    const points = allDays.map((day) => {
      let sum = 0
      let count = 0
      for (const [itemId, map] of byItem) {
        const price = map.get(day)
        let itemState = state.get(itemId)
        if (price != null) {
          if (!itemState && price > 0) {
            itemState = { first: price, last: price }
            state.set(itemId, itemState)
          } else if (itemState) {
            itemState.last = price
          }
        }
        if (itemState && itemState.first > 0) {
          sum += (itemState.last / itemState.first) * 100
          count += 1
        }
      }
      return { date: day, index: count > 0 ? sum / count : null }
    })
    return {
      storeId,
      storeName: storeId === 'unknown' ? 'Unknown store' : storeName(stores, storeId),
      points,
    }
  })
  series.sort((left, right) => left.storeName.localeCompare(right.storeName))
  return series
}

function flowGrain(deals: Deal[]): 'day' | 'week' {
  const days = deals.map((deal) => dayKey(deal.found_at)).filter(Boolean).sort()
  if (days.length < 2) return 'day'
  const first = Date.parse(`${days[0]}T00:00:00Z`)
  const last = Date.parse(`${days[days.length - 1]}T00:00:00Z`)
  return last - first > 90 * 86400000 ? 'week' : 'day'
}

function weekStart(day: string): string {
  const [year, month, date] = day.split('-').map(Number)
  if (!year || !month || !date) return day
  const utc = new Date(Date.UTC(year, month - 1, date))
  const dow = utc.getUTCDay()
  const delta = dow === 0 ? -6 : 1 - dow
  utc.setUTCDate(utc.getUTCDate() + delta)
  return utc.toISOString().slice(0, 10)
}

function buildDealFlow(deals: Deal[], grain: 'day' | 'week'): DealFlowPoint[] {
  const buckets = new Map<string, DealFlowPoint>()
  for (const deal of deals) {
    const day = dayKey(deal.found_at)
    if (!day) continue
    const date = grain === 'week' ? weekStart(day) : day
    const row = buckets.get(date) ?? { date, must_buy: 0, good: 0, ok: 0, skip: 0, unrated: 0 }
    row[verdictGroup(deal.verdict)] += 1
    buckets.set(date, row)
  }
  return [...buckets.values()].sort((left, right) => left.date.localeCompare(right.date))
}

function scoreBuckets(deals: Deal[]): ScoreBucket[] {
  const buckets = [
    { label: '0–19', min: 0, max: 19 },
    { label: '20–39', min: 20, max: 39 },
    { label: '40–59', min: 40, max: 59 },
    { label: '60–79', min: 60, max: 79 },
    { label: '80–100', min: 80, max: 100 },
  ]
  return buckets.map((bucket) => ({
    label: bucket.label,
    count: deals.filter((deal) => deal.score != null && deal.score >= bucket.min && deal.score <= bucket.max).length,
  }))
}

function buildCategories(items: Item[], deals: Deal[], quotesByItem: Map<string, Quote[]>, includeTargets: boolean): CategoryStat[] {
  const groups = new Map<string, Item[]>()
  for (const item of items) {
    const key = categoryKey(item.category)
    const list = groups.get(key) ?? []
    list.push(item)
    groups.set(key, list)
  }
  return [...groups.entries()]
    .map(([category, group]) => {
      const ids = new Set(group.map((item) => item.id))
      let underTarget = 0
      let discountSum = 0
      let discountCount = 0
      for (const item of group) {
        const best = chooseBest(quotesByItem.get(item.id) ?? [])
        if (includeTargets && best && item.target_price != null && best.price < item.target_price) underTarget += 1
        if (best?.regularPrice != null && best.regularPrice > 0) {
          discountSum += ((best.regularPrice - best.price) / best.regularPrice) * 100
          discountCount += 1
        }
      }
      return {
        category,
        items: group.length,
        openDeals: deals.filter((deal) => deal.status === 'open' && ids.has(deal.item_id)).length,
        underTarget,
        avgDiscountPct: discountCount > 0 ? discountSum / discountCount : null,
      }
    })
    .sort((left, right) => right.items - left.items || left.category.localeCompare(right.category))
}

function buildAtl(
  items: Item[],
  history: PriceSnapshot[],
  quotesByItem: Map<string, Quote[]>,
  stores: Store[],
): AtlRow[] {
  const rows: AtlRow[] = []
  for (const item of items) {
    const low = allTimeLow(history.filter((snapshot) => snapshot.item_id === item.id))
    if (!low) continue
    const best = chooseBest(quotesByItem.get(item.id) ?? [])
    rows.push({
      itemId: item.id,
      itemName: item.name,
      category: item.category,
      atlPrice: low.price,
      atlAt: low.captured_at,
      atlStoreName: storeName(stores, low.store_id),
      currentPrice: best?.price ?? null,
      currentStoreName: best?.storeName ?? null,
      currentAt: best?.capturedAt ?? null,
      atLow: best != null && toCents(best.price) <= toCents(low.price),
      gap: best ? roundMoney(best.price - low.price) : null,
    })
  }
  rows.sort(
    (left, right) =>
      Number(right.atLow) - Number(left.atLow) ||
      (left.gap ?? Number.POSITIVE_INFINITY) - (right.gap ?? Number.POSITIVE_INFINITY) ||
      left.itemName.localeCompare(right.itemName),
  )
  return rows
}

function emptyStatusTotals(): Record<DealStatus, number> {
  return { open: 0, bought: 0, dismissed: 0, expired: 0 }
}

function buildInsight(model: Omit<AnalyticsModel, 'insight'>, includeTargets: boolean): string {
  if (model.itemCount === 0) {
    return includeTargets
      ? 'Add a watchlist item and Harbour will compare stores, targets, and all-time lows.'
      : 'Harbour compares Canadian store prices, regular prices, and all-time lows.'
  }
  if (model.pricedItemCount === 0) {
    return 'Items are on the watchlist, and prices will show up here after the daily check records a snapshot.'
  }
  const leader = model.storeStats.find((store) => store.wins > 0)
  const leaderText = leader
    ? `${leader.storeName} was cheapest on ${leader.wins} of ${model.itemDays} item-days in ${model.periodLabel}.`
    : `No store has a recorded price in ${model.periodLabel}.`
  if (!includeTargets) {
    const savingsText = model.regularSavings > 0
      ? `Current best prices are ${formatCadInline(model.regularSavings)} under the regular prices on those listings.`
      : 'No current listing is below its regular price.'
    const lowText = model.atLowCount > 0
      ? `${model.atLowCount} ${model.atLowCount === 1 ? 'item is' : 'items are'} at an all-time low.`
      : 'Nothing is at its all-time low right now.'
    return `${leaderText} ${savingsText} ${lowText}`
  }
  const targetText =
    model.underTargetCount > 0
      ? `${model.underTargetCount} ${model.underTargetCount === 1 ? 'item is' : 'items are'} under target by ${formatCadInline(model.underTargetSavings)} at the current best in-stock price.`
      : 'Nothing is under its target price right now.'
  return `${leaderText} ${targetText}`
}

function formatCadInline(value: number): string {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(value)
}
