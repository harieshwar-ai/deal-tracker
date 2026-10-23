import { describe, expect, it } from 'vitest'
import { buildTimeline } from './timeline'
import type { Dataset, Item, PriceSnapshot, Store } from './types'

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

  it('calls a store drop a drop when another store is already cheaper', () => {
    const events = buildTimeline(data([
      snap(1, 100, 10, { store_id: 'other' }),
      snap(2, 200, 8),
      snap(3, 190, 1),
    ]))
    expect(events.map((event) => event.kind)).toEqual(['drop'])
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
})
