import { describe, expect, it } from 'vitest'
import { heroStats } from './hero'
import type { Dataset, Item, PriceSnapshot, Store } from './types'

const now = new Date('2026-10-22T16:00:00.000Z')

function item(id: string, name: string, active = true): Item {
  return {
    id,
    name,
    public_summary: null,
    description: null,
    category: 'Electronics',
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
    active,
    created_at: '2026-09-01T16:00:00.000Z',
    updated_at: '2026-10-01T16:00:00.000Z',
  }
}

const store: Store = {
  id: 'cc',
  name: 'Canada Computers',
  base_url: 'https://www.canadacomputers.com',
  country: 'CA',
  membership: null,
  notes: null,
  enabled: true,
  created_at: '2026-09-01T16:00:00.000Z',
  updated_at: '2026-09-01T16:00:00.000Z',
}

function snap(id: number, itemId: string, price: number, daysAgo: number, regular: number | null = null): PriceSnapshot {
  return {
    id,
    item_id: itemId,
    store_id: 'cc',
    product_title: null,
    product_url: null,
    price,
    regular_price: regular,
    currency: 'CAD',
    in_stock: true,
    member_only: false,
    captured_at: new Date(now.getTime() - daysAgo * 86400000).toISOString(),
    sale_ends_at: null,
    shipping: null,
    product_name: null,
    meets_requirements: true,
  }
}

function dataset(items: Item[], snapshots: PriceSnapshot[]): Dataset {
  return { items, stores: [store], snapshots, deals: [] }
}

describe('hero stats', () => {
  it('sums current regular-price savings and names the strongest in-stock call', () => {
    const chair = item('chair', 'Chair')
    const tv = item('tv', 'TV')
    const paused = item('old', 'Old lamp', false)
    const data = dataset(
      [chair, tv, paused],
      [
        ...[0, 10, 20, 30].map((days, index) => snap(index + 1, 'chair', 200 + index * 10, days, 240)),
        snap(10, 'tv', 100, 0, 180),
        snap(11, 'old', 40, 1, 90),
      ],
    )
    const stats = heroStats(data, false, now)
    expect(stats.tracked).toBe(2)
    expect(stats.savings).toBe(120)
    expect(stats.lastScan).toBe(snap(1, 'chair', 200, 0).captured_at)
    expect(stats.best?.itemId).toBe('chair')
    expect(stats.best?.call).toBe('buy')
    expect(stats.best?.saving).toBe(40)
  })

  it('stays empty when nothing is in stock', () => {
    const stats = heroStats(dataset([item('chair', 'Chair')], []), false, now)
    expect(stats.best).toBeNull()
    expect(stats.savings).toBe(0)
    expect(stats.lastScan).toBeNull()
    expect(stats.tracked).toBe(1)
  })
})
