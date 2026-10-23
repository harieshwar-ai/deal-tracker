import { describe, expect, it } from 'vitest'
import { buyTiming, freshnessOf, priceBrief } from './context'
import type { PriceSnapshot, Store } from './types'

const now = new Date('2026-10-23T16:00:00.000Z')

const store: Store = {
  id: 'cc',
  name: 'Canada Computers',
  base_url: null,
  country: 'CA',
  membership: 'private membership',
  notes: 'private note',
  enabled: true,
  created_at: now.toISOString(),
  updated_at: now.toISOString(),
}

function snap(id: number, price: number, capturedAt: string, extra: Partial<PriceSnapshot> = {}): PriceSnapshot {
  return {
    id,
    item_id: 'chair',
    store_id: 'cc',
    product_title: 'Chair',
    product_url: null,
    price,
    regular_price: null,
    currency: 'CAD',
    in_stock: true,
    member_only: false,
    captured_at: capturedAt,
    sale_ends_at: null,
    shipping: null,
    product_name: 'Chair',
    meets_requirements: true,
    ...extra,
  }
}

describe('price brief', () => {
  it('uses qualifying in-stock prices for the current offer and the window lows', () => {
    const brief = priceBrief([
      snap(1, 500, '2026-10-22T16:00:00.000Z', { regular_price: 600 }),
      snap(2, 100, '2026-10-22T18:00:00.000Z', { meets_requirements: false }),
      snap(3, 80, '2026-10-21T16:00:00.000Z', { in_stock: false }),
      snap(4, 450, '2026-09-01T16:00:00.000Z'),
      snap(5, 20, '2026-07-01T16:00:00.000Z', { currency: 'USD' }),
    ], [store], now)
    expect(brief.currentPrice).toBe(500)
    expect(brief.currentStore).toBe('Canada Computers')
    expect(brief.percentOffRegular).toBeCloseTo(16.666, 2)
    expect(brief.low30?.price).toBe(500)
    expect(brief.low90?.price).toBe(450)
    expect(brief.allTime).toMatchObject({ price: 450, outOfStock: false })
    expect(brief.lastChecked).toBe('2026-10-22T18:00:00.000Z')
    expect(brief.freshness).toBe('fresh')
  })

  it('does not treat an out-of-stock price as the in-stock low', () => {
    const brief = priceBrief([
      snap(1, 200, '2026-10-20T16:00:00.000Z', { in_stock: false }),
    ], [store], now)
    expect(brief.currentPrice).toBe(200)
    expect(brief.inStock).toBe(false)
    expect(brief.low30).toBeNull()
    expect(brief.low90).toBeNull()
    expect(brief.allTime).toMatchObject({ price: 200, outOfStock: true })
  })

  it('names a cheaper month only when two months have in-stock days', () => {
    const thin = buyTiming([
      snap(1, 400, '2026-10-01T16:00:00.000Z'),
      snap(2, 420, '2026-10-02T16:00:00.000Z'),
    ], now)
    expect(thin.cheapestMonth).toBeNull()
    expect(thin.sentence).toContain('no cheaper month')
    expect(thin.calendar).toContain('not a price saved')

    const timed = buyTiming([
      snap(1, 500, '2026-10-01T16:00:00.000Z'),
      snap(2, 520, '2026-10-02T16:00:00.000Z'),
      snap(3, 300, '2026-09-01T16:00:00.000Z'),
      snap(4, 320, '2026-09-02T16:00:00.000Z'),
      snap(5, 50, '2026-09-03T16:00:00.000Z', { meets_requirements: false }),
      snap(6, 40, '2026-09-04T16:00:00.000Z', { in_stock: false }),
    ], now)
    expect(timed.cheapestMonth).toBe('September 2026')
    expect(timed.median).toBe(310)
    expect(timed.days).toBe(2)
    expect(timed.sentence).toContain('September 2026')
    expect(timed.sentence).not.toContain('50')
  })
})

describe('freshness', () => {
  it('splits recent checks from week-old ones', () => {
    expect(freshnessOf('2026-10-23T04:00:00.000Z', now)).toBe('fresh')
    expect(freshnessOf('2026-10-20T16:00:00.000Z', now)).toBe('recent')
    expect(freshnessOf('2026-10-01T16:00:00.000Z', now)).toBe('stale')
    expect(freshnessOf(null, now)).toBe('none')
  })
})
