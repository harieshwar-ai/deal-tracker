import { isCadCurrency, roundMoney } from './format'
import { isQualifying } from './offers'
import { allTimeLow, chooseBest, latestOffers, quoteFromSnapshot } from './quotes'
import type { Dataset } from './types'
import { priceCallForItem, type PriceCall } from './verdict'

export interface HeroDeal {
  itemId: string
  name: string
  price: number
  storeName: string
  saving: number
  call: PriceCall
}

export type HeroEmpty = 'quiet' | 'unqualified'

export interface HeroStats {
  tracked: number
  savings: number
  lastScan: string | null
  best: HeroDeal | null
  empty: HeroEmpty
}

const callRank: Record<PriceCall, number> = {
  buy: 0,
  good: 1,
  wait: 2,
}

export function heroStats(data: Dataset, includeTarget: boolean, now = new Date()): HeroStats {
  let lastScan: string | null = null
  let lastScanTime = Number.NEGATIVE_INFINITY
  for (const snapshot of data.snapshots) {
    const time = Date.parse(snapshot.captured_at)
    if (Number.isNaN(time) || time < lastScanTime) continue
    lastScanTime = time
    lastScan = snapshot.captured_at
  }

  const active = data.items.filter((item) => item.active)
  let savings = 0
  let best: (HeroDeal & { above: number }) | null = null
  let sawUnqualified = false
  for (const item of active) {
    const snapshots = data.snapshots.filter((snapshot) => snapshot.item_id === item.id)
    const qualifying = snapshots.filter(isQualifying)
    const current = chooseBest(latestOffers(qualifying).map((snapshot) => quoteFromSnapshot(snapshot, data.stores)))
    if (!current && snapshots.some((snapshot) => isCadCurrency(snapshot.currency) && snapshot.in_stock !== false)) {
      sawUnqualified = true
    }
    const saving = current && isCadCurrency(current.currency) && current.inStock !== false && current.regularPrice != null && current.regularPrice > current.price
      ? current.regularPrice - current.price
      : 0
    savings += saving
    if (!current || current.inStock === false || !isCadCurrency(current.currency)) continue
    const call = priceCallForItem({
      item,
      snapshots: qualifying,
      deals: data.deals.filter((deal) => deal.item_id === item.id),
      stores: data.stores,
      includeTarget,
      now,
    })
    const low = allTimeLow(qualifying)
    const above = low && low.price > 0 ? (current.price - low.price) / low.price : 1
    const candidate = {
      itemId: item.id,
      name: item.name,
      price: current.price,
      storeName: current.storeName,
      saving,
      call: call.call,
      above,
    }
    if (!best || preferDeal(candidate, best)) best = candidate
  }

  return {
    tracked: active.length,
    savings: roundMoney(savings),
    lastScan,
    empty: best ? 'quiet' : sawUnqualified ? 'unqualified' : 'quiet',
    best: best
      ? {
          itemId: best.itemId,
          name: best.name,
          price: best.price,
          storeName: best.storeName,
          saving: roundMoney(best.saving),
          call: best.call,
        }
      : null,
  }
}

function preferDeal(candidate: HeroDeal & { above: number }, current: HeroDeal & { above: number }): boolean {
  const rank = callRank[candidate.call] - callRank[current.call]
  if (rank !== 0) return rank < 0
  if (candidate.saving !== current.saving) return candidate.saving > current.saving
  if (candidate.above !== current.above) return candidate.above < current.above
  return candidate.name.localeCompare(current.name) < 0
}
