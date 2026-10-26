import { describe, expect, it } from 'vitest'
import { cheapestEver, offerQuotes } from '../domain/quotes'
import { snapshotsFromRollup } from './rollups'

describe('market rollups', () => {
  it('keeps the latest offer current and uses daily lows only for history', () => {
    const snapshots = snapshotsFromRollup(
      [{
        id: 9,
        item_id: 'item',
        store_id: 'store',
        product_title: 'Card',
        product_url: 'https://example.com/card',
        price: 800,
        regular_price: 900,
        currency: 'CAD',
        in_stock: true,
        captured_at: '2026-10-20T18:00:00.000Z',
        sale_ends_at: null,
        shipping: 0,
        product_name: 'RTX 5080',
        meets_requirements: true,
      }],
      [
        { item_id: 'item', store_id: 'store', day: '2026-10-01', qualifying_low: 700 },
        { item_id: 'item', store_id: 'store', day: '2026-10-20', qualifying_low: '750' },
        { item_id: 'item', store_id: 'store', day: 'bad', qualifying_low: 1 },
      ],
    )
    expect(snapshots.map((snapshot) => snapshot.id).filter((id) => id < 0)).toHaveLength(2)
    expect(snapshots.some((snapshot) => snapshot.member_only != null)).toBe(false)
    const quotes = offerQuotes(snapshots, [])
    expect(quotes).toHaveLength(1)
    expect(quotes[0]?.price).toBe(800)
    expect(cheapestEver(snapshots.filter((snapshot) => snapshot.meets_requirements === true))?.snapshot.price).toBe(700)
  })
})
