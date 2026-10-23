import { describe, expect, it } from 'vitest'
import { computeAnalytics } from './analytics'
import { priceBrief } from './context'
import { clusterDeals } from './deals'
import { heroStats } from './hero'
import { isQualifying } from './offers'
import { buildPriceHistory } from './history'
import { compareCandidateProducts } from './productCompare'
import { buildTimeline } from './timeline'
import type { Deal, Item, PriceSnapshot, Store } from './types'
import { priceCallForItem } from './verdict'
import { buildWatchRows } from './watchlist'

const now = new Date('2026-10-23T16:00:00.000Z')

const costco: Store = {
  id: 'costco',
  name: 'Costco',
  base_url: null,
  country: 'CA',
  membership: null,
  notes: null,
  enabled: true,
  created_at: '2026-09-01T16:00:00.000Z',
  updated_at: '2026-09-01T16:00:00.000Z',
}
const amazon: Store = { ...costco, id: 'amazon', name: 'Amazon' }

const chair: Item = {
  id: 'chair',
  name: 'Heavy-duty ergonomic gaming/office chair (big & tall)',
  public_summary: null,
  description: null,
  category: 'Furniture',
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
  created_at: '2026-09-01T16:00:00.000Z',
  updated_at: '2026-10-22T16:00:00.000Z',
}

function snap(id: number, storeId: string, price: number, day: string, extra: Partial<PriceSnapshot> = {}): PriceSnapshot {
  return {
    id,
    item_id: 'chair',
    store_id: storeId,
    product_title: 'Heavy-duty chair',
    product_url: null,
    price,
    regular_price: 499.99,
    currency: 'CAD',
    in_stock: true,
    member_only: false,
    captured_at: `${day}T16:00:00.000Z`,
    sale_ends_at: null,
    shipping: null,
    product_name: 'Heavy-duty chair',
    meets_requirements: true,
    ...extra,
  }
}

function deal(id: string, storeId: string, price: number, snapshotId: number): Deal {
  return {
    id,
    item_id: 'chair',
    store_id: storeId,
    snapshot_id: snapshotId,
    title: 'Heavy-duty chair',
    url: null,
    price,
    regular_price: 499.99,
    discount_pct: null,
    score: 40,
    verdict: 'good',
    reason: null,
    notified_at: null,
    expires_at: null,
    status: 'open',
    found_at: '2026-10-22T16:00:00.000Z',
  }
}

const soldOut = snap(1, 'costco', 299.99, '2026-10-22', { in_stock: false })
const amazonDays = [
  snap(2, 'amazon', 429.99, '2026-10-20'),
  snap(3, 'amazon', 429.99, '2026-10-21'),
  snap(4, 'amazon', 429.99, '2026-10-22'),
]
const unqualified = snap(5, 'costco', 100, '2026-10-22', { meets_requirements: false, in_stock: true, product_name: 'Basic chair' })
const snapshots = [soldOut, ...amazonDays, unqualified]
const deals = [deal('costco-oos', 'costco', 299.99, soldOut.id), deal('amazon-stock', 'amazon', 429.99, amazonDays[2].id)]
const data = { items: [chair], stores: [costco, amazon], snapshots, deals }

describe('out-of-stock and unqualified prices stay out of the public lows', () => {
  it('uses the in-stock Amazon price as the all-time low, not the sold-out Costco price', () => {
    const model = computeAnalytics(data, { preset: '90d', category: null, storeId: null, now, includeTargets: false })
    const row = model.allTimeLows.find((entry) => entry.itemId === 'chair')
    expect(row?.atlPrice).toBe(429.99)
    expect(row?.atlStoreName).toBe('Amazon')
    expect(row?.currentPrice).toBe(429.99)
    expect(row?.atLow).toBe(true)
    expect(row?.gap).toBe(0)
    expect(model.atLowCount).toBe(1)
    expect(model.insight).toMatch(/Amazon was cheapest on 3 of 3 item-days/)
    expect(model.insight).toMatch(/1 item is at an all-time low/)
    expect(model.insight).not.toMatch(/299\.99|Costco was cheapest/)
    expect(model.storeStats.find((store) => store.storeId === 'costco')?.wins).toBe(0)
    expect(model.storeStats.find((store) => store.storeId === 'amazon')?.wins).toBe(3)
    expect(model.storeIndex.map((series) => series.storeId)).not.toContain('costco')
    expect(model.storeIndex.map((series) => series.storeId)).toContain('amazon')

    const watched = buildWatchRows(data, now).find((entry) => entry.item.id === 'chair')
    expect(watched?.allTimeLow).toBe(429.99)
    expect(watched?.atLow).toBe(true)
    expect(watched?.best?.price).toBe(429.99)
    expect(watched?.spark).not.toContain(299.99)
    expect(watched?.spark).not.toContain(100)

    const brief = priceBrief(snapshots, [costco, amazon], now)
    expect(brief.allTime).toMatchObject({ price: 429.99, storeName: 'Amazon', outOfStock: false })
    expect(brief.currentPrice).toBe(429.99)
    expect(brief.low30?.price).toBe(429.99)

    const call = priceCallForItem({ item: chair, snapshots, deals, stores: [costco, amazon], includeTarget: false, now })
    expect(call.currentPrice).toBe(429.99)
    expect(call.storeName).toBe('Amazon')
    expect(call.reason).toMatch(/matches the all-time low/)
    expect(call.reason).not.toMatch(/299\.99|100/)

    const hero = heroStats(data, false, now)
    expect(hero.best?.price).toBe(429.99)
    expect(hero.best?.storeName).toBe('Amazon')

    const history = buildPriceHistory(snapshots.filter(isQualifying), [costco, amazon])
    const plotted = history.rows.flatMap((entry) => Object.values(entry))
    expect(plotted).toContain(429.99)
    expect(plotted).not.toContain(299.99)

    const events = buildTimeline(data)
    expect(events.filter((event) => event.kind === 'new_low').map((event) => event.price)).not.toContain(299.99)
    expect(events.filter((event) => event.kind === 'new_low').map((event) => event.price)).not.toContain(100)

    const compared = compareCandidateProducts(snapshots, [costco, amazon])
    const heavy = compared.find((product) => product.name.includes('Heavy-duty'))
    const basic = compared.find((product) => product.name.includes('Basic'))
    expect(heavy?.stock).toBe(true)
    expect(heavy?.lowest).toMatchObject({ price: 429.99, outOfStock: false, storeName: 'Amazon' })
    expect(basic?.stock).toBeNull()
    expect(basic?.lowest).toBeNull()

    const oosVariant = { ...soldOut, store_id: 'amazon', product_name: 'Cybeart NEO (Lunar Edition)', product_title: 'Cybeart NEO (Lunar Edition)' }
    const stockedVariant = { ...amazonDays[2], product_name: 'Cybeart NEO (Stealth Edition)', product_title: 'Cybeart NEO (Stealth Edition)' }
    const clustered = clusterDeals(
      [
        { ...deals[0], title: 'Cybeart NEO (Lunar Edition)', store_id: 'amazon', snapshot_id: oosVariant.id, price: 299.99 },
        { ...deals[1], title: 'Cybeart NEO (Stealth Edition)', store_id: 'amazon', snapshot_id: stockedVariant.id, price: 429.99 },
      ],
      [oosVariant, stockedVariant],
    )
    expect(clustered).toHaveLength(1)
    expect(clustered[0]?.deal.price).toBe(429.99)
  })
})
