import { describe, expect, it } from 'vitest'
import { missingColumnName, parseDealRow, parseItemRow, parseStoreRow } from './parse'
import { selectColumns, visitorHiddenColumns } from './columns'

describe('visitor selects', () => {
  it('lists only columns anon will be allowed to read', () => {
    const tables = ['items', 'stores', 'deals'] as const
    for (const table of tables) {
      const selected = selectColumns(table, false).split(',')
      expect(selected).not.toContain('*')
      for (const hidden of visitorHiddenColumns[table]) expect(selected).not.toContain(hidden)
    }
    expect(selectColumns('items', false).split(',')).toContain('public_summary')
    expect(selectColumns('items', false).split(',')).toContain('image_url')
    expect(selectColumns('items', true).split(',')).toContain('image_url')
    expect(selectColumns('items', true).split(',')).toEqual(expect.arrayContaining([...visitorHiddenColumns.items]))
    expect(selectColumns('stores', true).split(',')).toEqual(expect.arrayContaining([...visitorHiddenColumns.stores]))
    expect(selectColumns('deals', false).split(',')).not.toContain('reason')
    expect(selectColumns('deals', true).split(',')).toContain('reason')
    expect(selectColumns('price_snapshots', false)).toBe(selectColumns('price_snapshots', true))
  })

  it('parses a public item without private fields', () => {
    const item = parseItemRow({
      id: 'item-1',
      name: 'Chair',
      public_summary: 'A chair for a tall desk.',
      category: 'Furniture',
      keywords: ['chair'],
      condition: 'new',
      priority: 'high',
      active: true,
      created_at: '2026-10-22T16:00:00.000Z',
      updated_at: '2026-10-22T16:00:00.000Z',
    })
    expect(item.public_summary).toBe('A chair for a tall desk.')
    expect(item.image_url).toBeNull()
    expect(item.description).toBeNull()
    expect(item.notes).toBeNull()
    expect(item.target_price).toBeNull()
    expect(item.max_price).toBeNull()
    const store = parseStoreRow({
      id: 'store-1',
      name: 'Costco',
      base_url: 'https://www.costco.ca',
      country: 'CA',
      enabled: true,
      created_at: '2026-10-22T16:00:00.000Z',
      updated_at: '2026-10-22T16:00:00.000Z',
    })
    expect(store.membership).toBeNull()
    expect(store.notes).toBeNull()
    const deal = parseDealRow({
      id: 'deal-1',
      item_id: 'item-1',
      store_id: 'store-1',
      snapshot_id: null,
      title: 'Chair',
      url: null,
      price: 195.89,
      regular_price: null,
      discount_pct: null,
      score: 10,
      verdict: 'good',
      notified_at: null,
      expires_at: null,
      status: 'open',
      found_at: '2026-10-22T16:00:00.000Z',
    })
    expect(deal.reason).toBeNull()
  })

  it('names a missing column so the reader can drop it and continue', () => {
    expect(missingColumnName({ code: '42703', message: 'column items.image_url does not exist' })).toBe('image_url')
    expect(missingColumnName({ message: "Could not find the 'image_url' column of 'items' in the schema cache" })).toBe('image_url')
    expect(missingColumnName({ message: 'permission denied for table items' })).toBeNull()
  })
})