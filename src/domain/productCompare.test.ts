import { describe, expect, it } from 'vitest'
import { compareCandidateProducts, sortComparedProducts, sortStoreRows, storeRowsFromQuotes } from './productCompare'
import { offerQuotes } from './quotes'
import type { PriceSnapshot, Store } from './types'

const now = '2026-10-23T16:00:00.000Z'

const amazon: Store = {
  id: 'amazon',
  name: 'Amazon',
  base_url: null,
  country: 'CA',
  membership: null,
  notes: null,
  enabled: true,
  created_at: now,
  updated_at: now,
}
const costco: Store = { ...amazon, id: 'costco', name: 'Costco' }

function snap(id: number, name: string, extra: Partial<PriceSnapshot> = {}): PriceSnapshot {
  return {
    id,
    item_id: 'chair',
    store_id: 'amazon',
    product_title: name,
    product_url: null,
    price: 400,
    regular_price: null,
    currency: 'CAD',
    in_stock: true,
    member_only: false,
    captured_at: now,
    sale_ends_at: null,
    shipping: 0,
    product_name: name,
    meets_requirements: true,
    ...extra,
  }
}

describe('candidate product comparison', () => {
  it('groups colourways, prices tax and shipping, and ignores non-qualifying and out-of-stock lows', () => {
    const products = compareCandidateProducts([
      snap(1, 'Cybeart NEO (Lunar Edition)', { product_url: 'https://www.amazon.ca/dp/B0F62K8T2Z', price: 429.99, shipping: 10 }),
      snap(2, 'Cybeart NEO (Stealth Edition)', { product_url: 'https://www.amazon.ca/dp/B0GFF1ZQGY', price: 300, in_stock: false, shipping: 0 }),
      snap(3, 'Cybeart NEO', { store_id: 'costco', price: 299.99, shipping: null, captured_at: '2026-10-01T16:00:00.000Z' }),
      snap(4, 'SIHOO B100 PRO', { product_url: 'https://www.amazon.ca/dp/B0HB72WC3F', price: 289.99, shipping: 0 }),
      snap(5, 'SIHOO B100 PRO', { product_url: 'https://www.amazon.ca/dp/B0HB72WC3F', price: 100, meets_requirements: false, shipping: 0 }),
      snap(6, 'SIHOO B300 PRO', { product_url: 'https://www.amazon.ca/dp/B0OTHER3001', price: 50, meets_requirements: false, shipping: 0 }),
    ], [amazon, costco])

    const neo = products.find((product) => product.name === 'Cybeart NEO')
    const b100 = products.find((product) => product.name.includes('B100'))
    const b300 = products.find((product) => product.name.includes('B300'))
    expect(neo).toBeTruthy()
    expect(b100?.name).not.toBe(b300?.name)
    expect(products.filter((product) => product.name.includes('NEO'))).toHaveLength(1)

    const amazonNeo = neo?.cells.find((cell) => cell.storeName === 'Amazon')
    expect(amazonNeo?.price).toBe(429.99)
    expect(amazonNeo?.tax).toBe(55.9)
    expect(amazonNeo?.shipping).toBe(10)
    expect(amazonNeo?.total).toBe(495.89)
    expect(amazonNeo?.variantHeading).toBe('Colours')
    expect(neo?.lowest).toMatchObject({ price: 299.99, outOfStock: false, storeName: 'Costco' })
    expect(neo?.stock).toBe(true)

    expect(b100?.cells.find((cell) => cell.storeName === 'Amazon')?.price).toBe(289.99)
    expect(b100?.meets).toBe('meets')
    expect(b300?.meets).toBe('misses')
    expect(b300?.best).toBe(false)
    expect(b300?.bestTotal).toBeNull()
    expect(b100?.best).toBe(true)
  })

  it('does not treat an unqualified in-stock listing as the qualifying low', () => {
    const products = compareCandidateProducts([
      snap(1, 'Anda Seat Phantom 4 Premium Gaming Chair Red', {
        product_url: 'https://www.amazon.ca/dp/B0PHANTOM4',
        price: 348,
        meets_requirements: false,
      }),
      snap(2, 'Anda Seat Phantom 3', {
        product_url: 'https://www.amazon.ca/dp/B0PHANTOM3',
        price: 300,
      }),
    ], [amazon])
    const phantom4 = products.find((product) => product.name.includes('Phantom 4'))
    const phantom3 = products.find((product) => product.name.includes('Phantom 3'))
    expect(phantom4?.meets).toBe('misses')
    expect(phantom4?.stock).toBeNull()
    expect(phantom4?.lowest).toBeNull()
    expect(phantom3?.stock).toBe(true)
    expect(phantom3?.lowest).toMatchObject({ price: 300, outOfStock: false })
  })

  it('sorts products by lowest seen and keeps missing prices last', () => {
    const products = compareCandidateProducts([
      snap(1, 'SIHOO B100 PRO', { price: 300, shipping: 0 }),
      snap(2, 'SIHOO B300 PRO', { price: 200, shipping: 0, product_url: 'https://www.amazon.ca/dp/B0B300PRO1' }),
    ], [amazon])
    const sorted = sortComparedProducts(products, 'lowest', 'asc')
    expect(sorted.map((product) => product.lowest?.price)).toEqual([200, 300])
    expect(sortComparedProducts(products, 'name', 'asc').map((product) => product.name)[0]).toContain('B100')
  })
})

describe('store comparison table', () => {
  it('marks the qualifying in-stock offer and keeps the in-stock low', () => {
    const snapshots = [
      snap(1, 'Cybeart NEO (Lunar Edition)', { product_url: 'https://www.amazon.ca/dp/B0F62K8T2Z', price: 429.99, shipping: 0 }),
      snap(2, 'Cybeart NEO', { store_id: 'costco', price: 299.99, shipping: 8 }),
      snap(3, 'Cybeart NEO', { store_id: 'costco', price: 100, in_stock: false, captured_at: '2026-09-01T16:00:00.000Z' }),
    ]
    const products = compareCandidateProducts(snapshots, [amazon, costco])
    expect(products[0]?.cells).toHaveLength(2)
    const quotes = offerQuotes(snapshots, [amazon, costco])
    const table = storeRowsFromQuotes(quotes, [], snapshots, quotes.find((quote) => quote.storeId === 'costco')?.snapshotId ?? null)
    const costcoRow = table.find((row) => row.storeName === 'Costco')
    expect(costcoRow?.price).toBe(299.99)
    expect(costcoRow?.total).toBeCloseTo(299.99 * 1.13 + 8, 2)
    expect(costcoRow?.lowest).toBe(299.99)
    expect(costcoRow?.lowestOutOfStock).toBe(false)
    expect(costcoRow?.bestPrice).toBe(true)
    expect(costcoRow?.meets).toBe('meets')
    const sorted = sortStoreRows(table, 'price', 'asc')
    expect(sorted[0]?.storeName).toBe('Costco')
  })
})
