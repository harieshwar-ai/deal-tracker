import { describe, expect, it } from 'vitest'
import { latestDealStock } from './deals'
import { buildTimeline } from './timeline'
import type { Dataset, Deal, Item, PriceSnapshot, Store } from './types'

const now = new Date('2026-10-22T16:00:00.000Z')

const item: Item = {
  id: 'chair',
  name: 'Chair',
  public_summary: null,
  description: null,
  category: null,
  keywords: [],
  target_price: null,
  max_price: null,
  priority: 'normal',
  condition: 'new',
  notes: null,
  image_url: null,
  specs: [],
  requirements: [],
  product_url: null,
  enrichment_status: 'ready',
  active: true,
  created_at: now.toISOString(),
  updated_at: now.toISOString(),
}

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

function snap(id: number, price: number, daysAgo: number, extra: Partial<PriceSnapshot> = {}): PriceSnapshot {
  return {
    id,
    item_id: 'chair',
    store_id: 'cc',
    product_title: null,
    product_url: null,
    price,
    regular_price: null,
    currency: 'CAD',
    in_stock: true,
    member_only: false,
    captured_at: new Date(now.getTime() - daysAgo * 86400000).toISOString(),
    sale_ends_at: null,
    shipping: null,
    product_name: null,
    meets_requirements: true,
    ...extra,
  }
}

function data(snapshots: PriceSnapshot[]): Dataset {
  return { items: [item], stores: [store], snapshots, deals: [] }
}

describe('price timeline', () => {
  it('marks the first later low as a new low and a later rise as a rise', () => {
    const events = buildTimeline(data([snap(1, 200, 10), snap(2, 180, 5), snap(3, 190, 0)]))
    expect(events.map((event) => event.kind)).toEqual(['raise', 'new_low'])
    expect(events[0]?.previousPrice).toBe(180)
    expect(events[1]?.price).toBe(180)
  })

  it('treats a store’s own lower price as its low even when another store is cheaper', () => {
    const events = buildTimeline(data([
      snap(1, 100, 10, { store_id: 'other' }),
      snap(2, 200, 8),
      snap(3, 190, 1),
    ]))
    expect(events.map((event) => event.kind)).toEqual(['new_low'])
    expect(events[0]?.price).toBe(190)
    expect(events[0]?.previousPrice).toBe(200)
  })

  it('records stock leaving and coming back', () => {
    const events = buildTimeline(data([
      snap(1, 200, 6, { in_stock: true }),
      snap(2, 200, 3, { in_stock: false }),
      snap(3, 200, 0, { in_stock: true }),
    ]))
    expect(events.map((event) => event.kind)).toEqual(['restock', 'out_of_stock'])
  })

  it('ignores a single snapshot', () => {
    expect(buildTimeline(data([snap(1, 200, 0)]))).toEqual([])
  })

  it('does not compare a different model or colour at the same store', () => {
    const events = buildTimeline(data([
      snap(1, 339.99, 2, {
        store_id: 'amazon',
        product_name: 'Sihoo B100 PRO / M18 Ergonomic Chair',
        product_url: 'https://www.amazon.ca/dp/B0HB72WC3F',
      }),
      snap(2, 289.99, 0, {
        store_id: 'amazon',
        product_name: 'SIHOO B100 PRO',
        product_url: 'https://www.amazon.ca/dp/B0HB72WC3F',
      }),
      snap(3, 329.99, 2, {
        store_id: 'amazon',
        product_name: 'Razer Iskur V2 X NewGen Quartz',
        product_url: 'https://www.amazon.ca/dp/B0GFPP6YL5',
      }),
      snap(4, 499.99, 0, {
        store_id: 'amazon',
        product_name: 'Razer Iskur V2 X NewGen',
        product_url: 'https://www.amazon.ca/dp/B0GFPP6YL5',
      }),
      snap(5, 349.99, 1, { store_id: 'amazon', product_name: 'SIHOO B300 PRO' }),
    ]))
    expect(events.filter((event) => event.kind === 'drop' || event.kind === 'raise' || event.kind === 'new_low')).toEqual([])

    const sameModel = buildTimeline(data([
      snap(6, 349.99, 2, { store_id: 'amazon', product_name: 'SIHOO B100 PRO', product_url: 'https://www.amazon.ca/dp/B0HB72WC3F' }),
      snap(7, 289.99, 0, { store_id: 'amazon', product_name: 'SIHOO B100 PRO', product_url: 'https://www.amazon.ca/dp/B0HB72WC3F' }),
    ]))
    expect(sameModel.map((event) => event.kind)).toEqual(['new_low'])
    expect(sameModel[0]?.previousPrice).toBe(349.99)
    expect(sameModel[0]?.price).toBe(289.99)
    expect(sameModel[0]?.productName).toContain('B100')
  })

  it('uses the latest stock of the deal’s own product', () => {
    const soldOut = snap(1, 299.99, 1, { store_id: 'costco', product_name: 'Cybeart NEO', in_stock: false })
    const stillOut = snap(2, 299.99, 0, { store_id: 'costco', product_name: 'Cybeart NEO', in_stock: false })
    const otherStore = snap(3, 429.99, 0, { store_id: 'amazon', product_name: 'Cybeart NEO (Lunar Edition)', in_stock: true })
    const deal: Deal = {
      id: 'neo',
      item_id: 'chair',
      store_id: 'costco',
      snapshot_id: soldOut.id,
      title: 'Cybeart NEO',
      url: null,
      price: 299.99,
      regular_price: null,
      discount_pct: null,
      score: 70,
      verdict: 'good',
      reason: null,
      notified_at: null,
      expires_at: null,
      status: 'open',
      found_at: soldOut.captured_at,
    }
    expect(latestDealStock(deal, [soldOut, stillOut, otherStore])).toBe(false)
    expect(latestDealStock(deal, [soldOut, { ...stillOut, in_stock: true }, otherStore])).toBe(true)
  })
})
