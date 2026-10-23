import { describe, expect, it } from 'vitest'
import { compareStores, itemTax, saleCountdown } from './compare'
import type { Quote } from './quotes'
import type { Deal } from './types'

const now = new Date('2026-10-22T16:00:00.000Z')

function quote(partial: Partial<Quote> & Pick<Quote, 'snapshotId' | 'storeName' | 'price'>): Quote {
  return {
    itemId: 'chair',
    storeId: partial.storeName,
    regularPrice: null,
    currency: 'CAD',
    inStock: true,
    memberOnly: false,
    capturedAt: now.toISOString(),
    productTitle: null,
    productUrl: null,
    saleEndsAt: null,
    shipping: null,
    ...partial,
  }
}

describe('store comparison', () => {
  it('adds Ontario HST and known shipping', () => {
    expect(itemTax(100)).toBe(13)
    expect(itemTax(195.89)).toBe(25.47)
    const rows = compareStores([
      quote({ snapshotId: 1, storeName: 'Best Buy', price: 200, shipping: 10 }),
      quote({ snapshotId: 2, storeName: 'Costco', price: 190, shipping: null, inStock: false }),
      quote({ snapshotId: 3, storeName: 'Canada Computers', price: 196, shipping: 8, saleEndsAt: '2026-10-25T16:00:00.000Z' }),
    ], [], 3)
    expect(rows.map((row) => row.storeName)).toEqual(['Canada Computers', 'Best Buy', 'Costco'])
    expect(rows[0]?.total).toBe(229.48)
    expect(rows[0]?.bestPrice).toBe(true)
    expect(rows[1]?.shippingKnown).toBe(true)
    expect(rows[2]?.shippingKnown).toBe(false)
    expect(saleCountdown(rows[0]?.saleEndsAt ?? null, now)).toBe('3 days left')
    expect(saleCountdown('2026-10-20T16:00:00.000Z', now)).toBe('Sale ended')
  })

  it('uses an open deal end when the snapshot has none', () => {
    const deal = {
      id: 'deal',
      item_id: 'chair',
      store_id: 'cc',
      snapshot_id: null,
      title: 'Chair',
      url: null,
      price: 196,
      regular_price: null,
      discount_pct: null,
      score: null,
      verdict: null,
      reason: null,
      notified_at: null,
      expires_at: '2026-10-23T04:00:00.000Z',
      status: 'open',
      found_at: now.toISOString(),
    } satisfies Deal
    const rows = compareStores([quote({ snapshotId: 1, storeName: 'Canada Computers', storeId: 'cc', price: 196 })], [deal], null)
    expect(rows[0]?.saleEndsAt).toBe('2026-10-23T04:00:00.000Z')
    expect(saleCountdown(rows[0]?.saleEndsAt ?? null, now)).toBe('12h left')
  })
})
