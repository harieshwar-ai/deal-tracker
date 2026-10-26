import { dayKey, formatCad, formatDay, formatPct, toCents } from './format'
import { isQualifying } from './offers'
import { cheapestEver, chooseBest, offerQuotes } from './quotes'
import type { Quote } from './quotes'
import type { Dataset, Deal, Item, PriceSnapshot, Store } from './types'

export type PriceCall = 'buy' | 'good' | 'wait'

export interface PriceCallResult {
  itemId: string
  call: PriceCall
  confidence: number
  reason: string
  currentPrice: number | null
  storeName: string | null
}

const minHistoryDays = 3
const atlHistoryDays = 14

export function priceCallLabel(call: PriceCall): string {
  switch (call) {
    case 'buy':
      return 'Buy now'
    case 'good':
      return 'Good price'
    case 'wait':
      return 'Wait'
    default: {
      const neverCall: never = call
      return neverCall
    }
  }
}

export function priceCallTone(call: PriceCall): string {
  switch (call) {
    case 'buy':
      return 'bg-buy text-on-buy'
    case 'good':
      return 'bg-buy-soft text-buy'
    case 'wait':
      return 'bg-wait-soft text-wait'
    default: {
      const neverCall: never = call
      return neverCall
    }
  }
}

export function priceCallsForDataset(data: Dataset, includeTarget: boolean, now = new Date()): Map<string, PriceCallResult> {
  const snapshotsByItem = group(data.snapshots, (snapshot) => snapshot.item_id)
  const dealsByItem = group(data.deals, (deal) => deal.item_id)
  const calls = new Map<string, PriceCallResult>()
  for (const item of data.items) {
    calls.set(item.id, priceCallForItem({
      item,
      snapshots: snapshotsByItem.get(item.id) ?? [],
      deals: dealsByItem.get(item.id) ?? [],
      stores: data.stores,
      includeTarget,
      now,
    }))
  }
  return calls
}

export function priceCallForItem({
  item,
  snapshots,
  deals,
  stores,
  includeTarget,
  now = new Date(),
}: {
  item: Item
  snapshots: PriceSnapshot[]
  deals: Deal[]
  stores: Store[]
  includeTarget: boolean
  now?: Date
}): PriceCallResult {
  const qualifying = snapshots.filter(isQualifying)
  const quotes = offerQuotes(qualifying, stores)
  const current = chooseBest(quotes)
  const ever = cheapestEver(qualifying)
  const low = ever && !ever.outOfStock ? ever.snapshot : null
  const days = dailyMins(qualifying.filter((snapshot) => snapshot.in_stock !== false))
  if (!current && snapshots.some((snapshot) => !isQualifying(snapshot))) {
    return {
      itemId: item.id,
      call: 'wait',
      confidence: 18,
      reason: 'No qualifying offer yet.',
      currentPrice: null,
      storeName: null,
    }
  }
  const dayCount = days.length
  const average = dayCount >= 2 ? days.reduce((sum, day) => sum + day.price, 0) / dayCount : null
  const trendPct = trendPercent(days)
  const inStock = current != null && current.inStock !== false
  const percentFromAtl = current && low && low.price > 0 ? ((current.price - low.price) / low.price) * 100 : null
  const vsAverage = current && average && average > 0 ? ((current.price - average) / average) * 100 : null
  const saleEnd = nextSaleEnd(deals, now)
  const target = includeTarget ? item.target_price : null

  let score = 45
  const atlReady = dayCount >= atlHistoryDays
  if (percentFromAtl != null) {
    if (atlReady && percentFromAtl <= 1) score += 30
    else if (atlReady && percentFromAtl <= 5) score += 15
    else if (percentFromAtl >= 12) score -= 22
  }
  if (vsAverage != null && dayCount >= minHistoryDays) {
    if (vsAverage <= -5) score += 12
    else if (vsAverage >= 8) score -= 12
  }
  if (trendPct != null) {
    if (trendPct <= -5) score += 12
    else if (trendPct >= 5) score -= 12
  }
  if (target != null && current) {
    if (current.price <= target) score += 18
    else score -= 14
  }
  if (saleEnd && current && percentFromAtl != null && percentFromAtl <= 8) score += 6
  if (!inStock) score -= 35

  let confidence = Math.min(88, 22 + dayCount * 7)
  if (trendPct != null) confidence += 8
  if (dayCount < minHistoryDays) confidence = Math.min(confidence, 34)
  if (!current) confidence = 18
  confidence = Math.max(10, Math.min(95, Math.round(confidence)))

  const mustBuy = current != null && inStock && hasOpenMustBuy(deals, current)
  let call = decide(score, dayCount, inStock, current != null, target != null && current != null && current.price <= target)
  if (call === 'buy' && !mustBuy) call = 'good'
  if (mustBuy) call = 'buy'
  const reason = mustBuy && current
    ? `${formatCad(current.price)} at ${current.storeName} is an open must-buy.`
    : explain({
        current,
        dayCount,
        percentFromAtl,
        vsAverage,
        trendPct,
        target,
        currentPrice: current?.price ?? null,
        saleEnd,
        inStock,
      })
  return {
    itemId: item.id,
    call,
    confidence,
    reason,
    currentPrice: current?.price ?? null,
    storeName: current?.storeName ?? null,
  }
}

function hasOpenMustBuy(deals: Deal[], quote: Quote): boolean {
  const price = toCents(quote.price)
  const storeId = quote.storeId ?? null
  return deals.some((deal) => (
    deal.status === 'open'
    && deal.verdict === 'must_buy'
    && (deal.store_id ?? null) === storeId
    && toCents(deal.price) === price
  ))
}

function decide(score: number, dayCount: number, inStock: boolean, hasPrice: boolean, underTarget: boolean): PriceCall {
  if (!hasPrice || !inStock) return 'wait'
  if (dayCount < minHistoryDays) return underTarget ? 'good' : 'wait'
  if (score >= 72) return 'buy'
  if (score >= 48) return 'good'
  return 'wait'
}

function explain(input: {
  current: Quote | null
  dayCount: number
  percentFromAtl: number | null
  vsAverage: number | null
  trendPct: number | null
  target: number | null
  currentPrice: number | null
  saleEnd: string | null
  inStock: boolean
}): string {
  if (!input.current) return 'No in-stock CAD price is saved yet.'
  const where = `${formatCad(input.current.price)} at ${input.current.storeName}`
  if (!input.inStock) return `${where} is out of stock.`
  if (input.percentFromAtl != null && input.percentFromAtl <= 1 && input.dayCount < atlHistoryDays) {
    const days = input.dayCount === 1 ? '1 priced day' : `${input.dayCount} priced days`
    const targetNote = targetNoteFor(input.target, input.currentPrice)
    return `${where} is the lowest price saved so far, from ${days}. That is not enough history to call it a buy.${targetNote}`
  }
  const bits: string[] = []
  if (input.percentFromAtl != null && input.percentFromAtl <= 1 && input.dayCount >= atlHistoryDays) bits.push('matches the all-time low')
  else if (input.percentFromAtl != null) bits.push(`is ${formatPct(input.percentFromAtl, 0)} above the all-time low`)
  if (input.vsAverage != null && input.vsAverage <= -1) bits.push(`${formatPct(Math.abs(input.vsAverage), 0)} under the average`)
  else if (input.vsAverage != null && input.vsAverage >= 1) bits.push(`${formatPct(input.vsAverage, 0)} over the average`)
  if (input.trendPct != null && input.trendPct <= -1) bits.push(`down ${formatPct(Math.abs(input.trendPct), 0)} over about 30 days`)
  else if (input.trendPct != null && input.trendPct >= 1) bits.push(`up ${formatPct(input.trendPct, 0)} over about 30 days`)
  if (input.saleEnd && input.percentFromAtl != null && input.percentFromAtl <= 8) {
    bits.push(`an open offer lists an end on ${formatDay(input.saleEnd)}`)
  }
  const sentence = bits.length === 0
    ? `${where} has no clear edge versus its own history.`
    : `${where} ${bits.join(', ')}.`
  return `${sentence}${targetNoteFor(input.target, input.currentPrice)}`
}

function targetNoteFor(target: number | null, price: number | null): string {
  if (target == null || price == null) return ''
  if (price <= target) return ' It is at or under the target.'
  return ` It is ${formatCad(price - target)} over the target.`
}

function dailyMins(snapshots: PriceSnapshot[]): { day: string; price: number }[] {
  const byDay = new Map<string, number>()
  for (const snapshot of snapshots) {
    if ((snapshot.currency ?? '').toUpperCase() !== 'CAD') continue
    const day = dayKey(snapshot.captured_at)
    if (!day) continue
    const current = byDay.get(day)
    if (current == null || snapshot.price < current) byDay.set(day, snapshot.price)
  }
  return [...byDay.entries()]
    .map(([day, price]) => ({ day, price }))
    .sort((left, right) => left.day.localeCompare(right.day))
}

function trendPercent(days: { day: string; price: number }[]): number | null {
  const latest = days[days.length - 1]
  if (!latest) return null
  let best: { day: string; price: number; distance: number } | null = null
  for (const day of days) {
    const gap = dayDistance(day.day, latest.day)
    if (gap < 14 || gap > 45) continue
    const distance = Math.abs(gap - 30)
    if (!best || distance < best.distance) best = { ...day, distance }
  }
  if (!best || best.price <= 0) return null
  return ((latest.price - best.price) / best.price) * 100
}

function dayDistance(earlier: string, later: string): number {
  const start = Date.parse(`${earlier}T00:00:00.000Z`)
  const end = Date.parse(`${later}T00:00:00.000Z`)
  if (Number.isNaN(start) || Number.isNaN(end)) return 0
  return Math.round((end - start) / 86400000)
}

function nextSaleEnd(deals: Deal[], now: Date): string | null {
  const nowMs = now.getTime()
  let best: string | null = null
  for (const deal of deals) {
    if (deal.status !== 'open' || !deal.expires_at) continue
    const time = Date.parse(deal.expires_at)
    if (Number.isNaN(time) || time < nowMs) continue
    if (time - nowMs > 7 * 86400000) continue
    if (!best || time < Date.parse(best)) best = deal.expires_at
  }
  return best
}

function group<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const grouped = new Map<string, T[]>()
  for (const row of rows) {
    const id = key(row)
    const list = grouped.get(id) ?? []
    list.push(row)
    grouped.set(id, list)
  }
  return grouped
}
