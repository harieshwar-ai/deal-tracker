import { describe, expect, it } from 'vitest'
import { biggestDropThisWeek, marketOverview, openGoodDeals, recentChanges, versusTypical } from './overview'
import type { TimelineEvent } from './timeline'
import type { Deal, Dataset, Item, PriceSnapshot, Store } from './types'

function event(id: string, at: string, price: number, previous: number): TimelineEvent {
  return {
    id,
    itemId: 'item',
    itemName: 'Chair',
    storeName: 'Costco',
    productName: 'Black',
    kind: 'drop',
    at,
    price,
    previousPrice: previous,
  }
}

describe('market overview helpers', () => {
  it('keeps the latest change for a variant and describes the gap to typical', () => {
    const changes = recentChanges([
      event('old', '2026-10-01T00:00:00.000Z', 90, 100),
      event('new', '2026-10-20T00:00:00.000Z', 80, 90),
      { ...event('other', '2026-10-21T00:00:00.000Z', 70, 80), productName: 'White' },
    ], 8)
    expect(changes.map((entry) => entry.id)).toEqual(['other', 'new'])
    expect(versusTypical(80, 100)).toBe('20% below typical')
    expect(versusTypical(100, 100)).toBe('At typical')
    expect(versusTypical(null, 100)).toBe('—')
  })

  it('ranks in-stock open deals and ignores a sold-out drop', () => {
    const now = new Date('2026-10-22T16:00:00.000Z')
    const data = sampleMarket(now)
    expect(openGoodDeals(data)).toHaveLength(3)
    expect(data.deals.filter((deal) => deal.status === 'open')).toHaveLength(4)
    const overview = marketOverview(data, false, now)
    expect(overview.openGoodDeals).toBe(3)
    expect(overview.bestDeals.map((deal) => deal.id)).toEqual(['ram', 'ssd'])
    expect(overview.bestDeals[0]?.call).toBe('buy')
    expect(overview.bestDeals[0]?.versus).toBe('20% below typical')
    expect(overview.biggestDrop).toMatchObject({ itemName: 'RAM', amount: 40, storeName: 'Memory Express' })
    expect(overview.biggestDrop?.percent).toBeCloseTo(20, 5)
    expect(biggestDropThisWeek(data, now)?.itemName).not.toBe('RTX 5090')
  })
})

function sampleMarket(now: Date): Dataset {
  const store = (id: string, name: string): Store => ({
    id,
    name,
    base_url: null,
    country: 'CA',
    membership: null,
    notes: null,
    enabled: true,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  })
  const item = (id: string, name: string): Item => ({
    id,
    name,
    public_summary: null,
    description: null,
    category: 'Memory (RAM)',
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
  })
  const snap = (id: number, itemId: string, storeId: string, price: number, day: string, extra: Partial<PriceSnapshot> = {}): PriceSnapshot => ({
    id,
    item_id: itemId,
    store_id: storeId,
    product_title: itemId,
    product_url: null,
    price,
    regular_price: null,
    currency: 'CAD',
    in_stock: true,
    member_only: null,
    captured_at: `${day}T16:00:00.000Z`,
    sale_ends_at: null,
    shipping: null,
    product_name: itemId,
    meets_requirements: true,
    ...extra,
  })
  const deal = (id: string, itemId: string, storeId: string, price: number, verdict: Deal['verdict'], snapshotId: number): Deal => ({
    id,
    item_id: itemId,
    store_id: storeId,
    snapshot_id: snapshotId,
    title: itemId,
    url: null,
    price,
    regular_price: null,
    discount_pct: null,
    score: 80,
    verdict,
    reason: null,
    notified_at: null,
    expires_at: null,
    status: 'open',
    found_at: now.toISOString(),
  })
  return {
    items: [item('ram', 'RAM'), item('ssd', 'SSD'), item('gpu', 'RTX 5090')],
    stores: [store('memex', 'Memory Express'), store('bestbuy', 'Best Buy')],
    snapshots: [
      snap(1, 'ram', 'memex', 200, '2026-10-10'),
      snap(7, 'ram', 'memex', 200, '2026-10-18'),
      snap(2, 'ram', 'memex', 160, '2026-10-20'),
      snap(3, 'ssd', 'memex', 90, '2026-10-10'),
      snap(4, 'ssd', 'memex', 80, '2026-10-21'),
      snap(5, 'gpu', 'bestbuy', 4000, '2026-10-16'),
      snap(6, 'gpu', 'bestbuy', 990, '2026-10-22', { in_stock: false }),
    ],
    deals: [
      deal('ram', 'ram', 'memex', 160, 'must_buy', 2),
      deal('ssd', 'ssd', 'memex', 80, 'good', 4),
      deal('gpu', 'gpu', 'bestbuy', 990, 'must_buy', 6),
      { ...deal('ok-ram', 'ram', 'memex', 160, 'ok', 2), verdict: 'ok' },
    ],
  }
}