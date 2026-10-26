import { describe, expect, it } from 'vitest'
import type { Deal, Item, PriceSnapshot, Store } from './types'
import { priceCallForItem } from './verdict'

const now = new Date('2026-10-22T16:00:00.000Z')

function item(target: number | null = null): Item {
  return {
    id: 'chair',
    name: 'Chair',
    public_summary: null,
    description: null,
    category: 'Furniture',
    keywords: [],
    target_price: target,
    max_price: null,
    priority: 'normal',
    condition: 'new',
    notes: 'private note',
    image_url: null,
    specs: [],
    requirements: [],
    product_url: null,
    enrichment_status: 'ready',
    active: true,
    created_at: '2026-09-01T16:00:00.000Z',
    updated_at: '2026-10-01T16:00:00.000Z',
  }
}

const store: Store = {
  id: 'cc',
  name: 'Canada Computers',
  base_url: 'https://www.canadacomputers.com',
  country: 'CA',
  membership: 'insider',
  notes: 'private',
  enabled: true,
  created_at: '2026-09-01T16:00:00.000Z',
  updated_at: '2026-09-01T16:00:00.000Z',
}

function snap(id: number, price: number, daysAgo: number, extra: Partial<PriceSnapshot> = {}): PriceSnapshot {
  return {
    id,
    item_id: 'chair',
    store_id: 'cc',
    product_title: null,
    product_url: null,
    price,
    regular_price: price + 40,
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

describe('price calls', () => {
  it('refuses a buy call when only one day is saved', () => {
    const result = priceCallForItem({
      item: item(300),
      snapshots: [snap(1, 196, 0)],
      deals: [],
      stores: [store],
      includeTarget: false,
      now,
    })
    expect(result.call).toBe('wait')
    expect(result.confidence).toBeLessThanOrEqual(34)
    expect(result.reason).toMatch(/1 priced day/)
    expect(result.reason.toLowerCase()).not.toContain('target')
    expect(result.reason.toLowerCase()).not.toContain('private')
  })

  it('does not call buy from a short all-time low without an open must-buy', () => {
    const snapshots = [0, 3, 7, 14, 21, 30].map((days, index) => snap(index + 1, 200 + index * 4, days))
    const result = priceCallForItem({
      item: item(),
      snapshots,
      deals: [],
      stores: [store],
      includeTarget: false,
      now,
    })
    expect(result.call).not.toBe('buy')
    expect(result.reason).not.toMatch(/all-time low/)
    expect(result.reason).toMatch(/not enough history/)
  })

  it('calls buy only when an open must-buy matches the current store and price', () => {
    const snapshots = [0, 3, 7, 14, 21, 30].map((days, index) => snap(index + 1, 200 + index * 4, days))
    const mustBuy: Deal = {
      id: 'deal',
      item_id: 'chair',
      store_id: 'cc',
      snapshot_id: 1,
      title: 'Chair',
      url: null,
      price: 200,
      regular_price: null,
      discount_pct: null,
      score: 90,
      verdict: 'must_buy',
      reason: 'private reason',
      notified_at: null,
      expires_at: null,
      status: 'open',
      found_at: now.toISOString(),
    }
    const matched = priceCallForItem({
      item: item(),
      snapshots,
      deals: [mustBuy],
      stores: [store],
      includeTarget: false,
      now,
    })
    expect(matched.call).toBe('buy')
    expect(matched.reason).toMatch(/open must-buy/)
    expect(matched.reason.toLowerCase()).not.toContain('private')
    const otherStore = priceCallForItem({
      item: item(),
      snapshots,
      deals: [{ ...mustBuy, store_id: 'other', price: 180 }],
      stores: [store],
      includeTarget: false,
      now,
    })
    expect(otherStore.call).not.toBe('buy')
  })

  it('waits when the current price sits well above the low', () => {
    const snapshots = [
      snap(1, 180, 40),
      snap(2, 182, 30),
      snap(3, 184, 20),
      snap(4, 186, 10),
      snap(5, 240, 0),
    ]
    const result = priceCallForItem({
      item: item(),
      snapshots,
      deals: [],
      stores: [store],
      includeTarget: false,
      now,
    })
    expect(result.call).toBe('wait')
    expect(result.reason).toMatch(/above the all-time low/)
  })

  it('waits when the latest offer is out of stock', () => {
    const result = priceCallForItem({
      item: item(),
      snapshots: [snap(1, 180, 20), snap(2, 170, 0, { in_stock: false })],
      deals: [],
      stores: [store],
      includeTarget: false,
      now,
    })
    expect(result.call).toBe('wait')
    expect(result.reason).toMatch(/out of stock/)
  })

  it('lets the owner factor a target the visitor never sees', () => {
    const snapshots = [snap(1, 200, 0)]
    const shared = { snapshots, deals: [] as Deal[], stores: [store], now }
    const visitor = priceCallForItem({ ...shared, item: item(250), includeTarget: false })
    const owner = priceCallForItem({ ...shared, item: item(250), includeTarget: true })
    expect(visitor.call).toBe('wait')
    expect(visitor.reason.toLowerCase()).not.toContain('target')
    expect(owner.call).toBe('good')
    expect(owner.reason).toMatch(/target/)
  })
})
