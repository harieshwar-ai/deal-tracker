import { describe, expect, it } from 'vitest'
import { recentChanges, versusTypical } from './overview'
import type { TimelineEvent } from './timeline'

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
})