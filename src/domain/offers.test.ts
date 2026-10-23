import { describe, expect, it } from 'vitest'
import { heroStats } from './hero'
import { isQualifying, requirementLabel } from './offers'
import { allTimeLow, cheapestEver, chooseBest, latestOffers, quoteFromSnapshot } from './quotes'
import type { Dataset, Item, PriceSnapshot, Store } from './types'
import { priceCallForItem } from './verdict'

const now = new Date('2026-10-22T16:00:00.000Z')

const store: Store = {
  id: 'cc',
  name: 'Canada Computers',
  base_url: null,
  country: 'CA',
  membership: null,
  notes: null,
  enabled: true,
  created_at: now.toISOString(),
  updated_at: now.toISOString(),
}

function item(): Item {
  return {
    id: 'chair',
    name: 'Chair',
    public_summary: null,
    description: null,
    category: 'Furniture',
    keywords: [],
    target_price: 300,
    max_price: null,
    priority: 'normal',
    condition: 'new',
    notes: null,
    image_url: null,
    specs: [],
    requirements: [{ label: '150 kg rating' }],
    product_url: null,
    enrichment_status: 'ready',
    active: true,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  }
}

function snap(id: number, price: number, meets: boolean | null, name: string | null, daysAgo = 0): PriceSnapshot {
  return {
    id,
    item_id: 'chair',
    store_id: 'cc',
    product_title: name,
    product_url: null,
    price,
    regular_price: price + 20,
    currency: 'CAD',
    in_stock: true,
    member_only: false,
    captured_at: new Date(now.getTime() - daysAgo * 86400000).toISOString(),
    sale_ends_at: null,
    shipping: null,
    product_name: name,
    meets_requirements: meets,
  }
}

describe('qualifying offers', () => {
  it('names a failing offer and an unverified one without personal detail', () => {
    expect(isQualifying(snap(1, 100, true, 'Chair'))).toBe(true)
    expect(isQualifying(snap(2, 100, false, 'Chair'))).toBe(false)
    expect(isQualifying(snap(3, 100, null, 'Chair'))).toBe(false)
    expect(requirementLabel(false)).toBe("Doesn't meet specs")
    expect(requirementLabel(null)).toBe('Unverified')
    expect(requirementLabel(true)).toBeNull()
    expect(requirementLabel(false)?.toLowerCase()).not.toContain('kg')
  })

  it('keeps a cheap failing listing out of the best price and the all-time low', () => {
    const snapshots = [
      snap(1, 349, true, 'Heavy-duty chair', 2),
      snap(2, 340, true, 'Heavy-duty chair', 0),
      snap(3, 195.89, false, 'Basic office chair', 0),
      snap(4, 121.88, false, 'Compact task chair', 1),
      snap(5, 250, null, 'Unverified listing', 0),
    ]
    const qualifying = snapshots.filter(isQualifying)
    const best = chooseBest(latestOffers(qualifying).map((snapshot) => quoteFromSnapshot(snapshot, [store])))
    expect(best?.price).toBe(340)
    expect(best?.productName).toBe('Heavy-duty chair')
    expect(allTimeLow(qualifying)?.price).toBe(340)
    expect(cheapestEver(qualifying)?.snapshot.price).toBe(340)
    expect(cheapestEver(qualifying)?.outOfStock).toBe(false)
    const call = priceCallForItem({
      item: item(),
      snapshots,
      deals: [],
      stores: [store],
      includeTarget: false,
      now,
    })
    expect(call.currentPrice).toBe(340)
    expect(call.reason).not.toMatch(/195\.89|121\.88/)
    expect(call.reason.toLowerCase()).not.toContain('kg')
  })

  it('collapses untitled scans at one store and keeps named products apart', () => {
    const older = snap(1, 195.89, false, null, 2)
    const newer = { ...snap(2, 135.88, null, null, 0), product_title: 'A different scanned title' }
    const named = { ...snap(3, 121.88, false, 'Compact task chair', 0), store_id: 'amazon' }
    const current = latestOffers([older, newer, named]).map((snapshot) => snapshot.id).sort((left, right) => left - right)
    expect(current).toEqual([2, 3])
  })

  it('says when nothing qualifies', () => {
    const snapshots = [snap(1, 121.88, false, 'Compact task chair'), snap(2, 195.89, null, 'Basic office chair')]
    const call = priceCallForItem({
      item: item(),
      snapshots,
      deals: [],
      stores: [store],
      includeTarget: true,
      now,
    })
    expect(call.call).toBe('wait')
    expect(call.currentPrice).toBeNull()
    expect(call.reason).toBe('No qualifying offer yet.')
    expect(call.reason.toLowerCase()).not.toContain('target')
    const data: Dataset = { items: [item()], stores: [store], snapshots, deals: [] }
    const stats = heroStats(data, false, now)
    expect(stats.best).toBeNull()
    expect(stats.savings).toBe(0)
    expect(stats.empty).toBe('unqualified')
  })

  it('keeps an out-of-stock price out of cheapest ever when an in-stock offer exists', () => {
    const stocked = snap(1, 349, true, 'Heavy-duty chair', 1)
    const soldOut = { ...snap(2, 121.88, true, 'Clearance chair', 0), in_stock: false }
    const ever = cheapestEver([stocked, soldOut])
    expect(ever?.snapshot.price).toBe(349)
    expect(ever?.outOfStock).toBe(false)
    expect(allTimeLow([stocked, soldOut])?.price).toBe(121.88)
  })

  it('labels the only qualifying price when it is out of stock', () => {
    const soldOut = { ...snap(1, 121.88, true, 'Clearance chair'), in_stock: false }
    const ever = cheapestEver([soldOut])
    expect(ever?.snapshot.price).toBe(121.88)
    expect(ever?.outOfStock).toBe(true)
  })
})
