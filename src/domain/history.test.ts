import { describe, expect, it } from 'vitest'
import { buildPriceHistory, HISTORY_OTHER_SERIES_ID, HISTORY_TOP_STORES, truncateListingLabel } from './history'
import type { PriceSnapshot, Store } from './types'

const now = new Date('2026-10-23T16:00:00.000Z')

const baseStore: Store = {
  id: 'amazon',
  name: 'Amazon',
  base_url: null,
  country: 'CA',
  membership: null,
  notes: null,
  enabled: true,
  created_at: now.toISOString(),
  updated_at: now.toISOString(),
}

const stores: Store[] = [
  baseStore,
  { ...baseStore, id: 'bestbuy', name: 'Best Buy' },
  { ...baseStore, id: 'newegg', name: 'Newegg' },
  { ...baseStore, id: 'memory', name: 'Memory Express' },
  { ...baseStore, id: 'canada', name: 'Canada Computers' },
  { ...baseStore, id: 'staples', name: 'Staples' },
  { ...baseStore, id: 'visions', name: 'Visions' },
  { ...baseStore, id: 'costco', name: 'Costco' },
]

function snap(id: number, storeId: string, price: number, day: string, product: string): PriceSnapshot {
  return {
    id,
    item_id: 'ram',
    store_id: storeId,
    product_title: product,
    product_url: null,
    price,
    regular_price: null,
    currency: 'CAD',
    in_stock: true,
    member_only: false,
    captured_at: `${day}T12:00:00.000Z`,
    sale_ends_at: null,
    shipping: null,
    product_name: product,
    meets_requirements: true,
  }
}

describe('buildPriceHistory', () => {
  it('groups listings into one line per store with a capped legend', () => {
    const snapshots: PriceSnapshot[] = []
    let id = 1
    for (const store of stores) {
      for (let listing = 0; listing < 8; listing += 1) {
        snapshots.push(snap(id++, store.id, 100 + listing, '2026-10-20', `${store.name} kit ${listing}`))
        snapshots.push(snap(id++, store.id, 90 + listing, '2026-10-21', `${store.name} kit ${listing}`))
      }
    }
    const history = buildPriceHistory(snapshots, stores)
    expect(history.series.length).toBeLessThanOrEqual(HISTORY_TOP_STORES + 1)
    expect(history.series.some((entry) => entry.id === HISTORY_OTHER_SERIES_ID)).toBe(true)
    expect(history.series.every((entry) => !entry.name.includes('·'))).toBe(true)
    const row = history.rows.find((entry) => entry.date === '2026-10-21')
    expect(row?.[HISTORY_OTHER_SERIES_ID]).toBe(90)
    for (const entry of history.series) {
      if (entry.id === HISTORY_OTHER_SERIES_ID) continue
      expect(row?.[entry.id]).toBe(90)
    }
  })

  it('keeps a single-store item readable', () => {
    const history = buildPriceHistory(
      [snap(1, 'amazon', 120, '2026-10-22', 'Short kit'), snap(2, 'amazon', 110, '2026-10-23', 'Long kit name')],
      stores,
    )
    expect(history.series).toEqual([expect.objectContaining({ id: 'amazon', name: 'Amazon' })])
    expect(history.rows).toHaveLength(2)
  })

  it('truncates long listing labels for tooltips', () => {
    const long = 'A'.repeat(80)
    expect(truncateListingLabel(long)).toHaveLength(52)
    expect(truncateListingLabel(long).endsWith('…')).toBe(true)
  })
})
