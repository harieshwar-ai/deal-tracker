import { describe, expect, it } from 'vitest'
import { computeAnalytics } from './analytics'
import { compareStores } from './compare'
import { clusterDeals } from './deals'
import { buildPriceHistory } from './history'
import { assignProducts, listingKey, parseOfferName } from './identity'
import { offerQuotes } from './quotes'
import { buildTimeline } from './timeline'
import type { Deal, Item, PriceSnapshot, Store } from './types'

const now = new Date('2026-10-23T16:00:00.000Z')

const amazon: Store = {
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

const costco: Store = { ...amazon, id: 'costco', name: 'Costco' }
const visions: Store = { ...amazon, id: 'visions', name: 'Visions Electronics' }

const item: Item = {
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
  created_at: now.toISOString(),
  updated_at: now.toISOString(),
}

function snap(
  id: number,
  productName: string | null,
  extra: Partial<PriceSnapshot> = {},
): PriceSnapshot {
  return {
    id,
    item_id: 'chair',
    store_id: 'amazon',
    product_title: productName,
    product_url: null,
    price: 429.99,
    regular_price: null,
    currency: 'CAD',
    in_stock: true,
    member_only: false,
    captured_at: new Date(now.getTime() - id * 1000).toISOString(),
    sale_ends_at: null,
    shipping: null,
    product_name: productName,
    meets_requirements: true,
    ...extra,
  }
}

function deal(id: string, title: string, price: number, extra: Partial<Deal> = {}): Deal {
  return {
    id,
    item_id: 'chair',
    store_id: 'amazon',
    snapshot_id: null,
    title,
    url: null,
    price,
    regular_price: null,
    discount_pct: null,
    score: 40,
    verdict: 'good',
    reason: null,
    notified_at: null,
    expires_at: null,
    status: 'open',
    found_at: now.toISOString(),
    ...extra,
  }
}

describe('product identity', () => {
  it('reads a strong listing id and ignores a store homepage or category page', () => {
    expect(listingKey('https://www.amazon.ca/dp/B0GFF1ZQGY?th=1')).toBe('amazon:B0GFF1ZQGY')
    expect(listingKey('https://www.amazon.ca/Cybeart-NEO/dp/B0F62K8T2Z')).toBe('amazon:B0F62K8T2Z')
    expect(listingKey('https://www.bestbuy.ca/en-ca/product/motiongrey-enforcer-pro/14310014')).toBe('bestbuy.ca/14310014')
    expect(listingKey('https://www.staples.ca/products/3114224-en-staples-hyken-xl')).toBe('staples.ca/3114224')
    expect(listingKey('https://www.costco.ca/p/-/cybeart-neo-office-and-gaming-chair/4201001240')).toBe('costco.ca/4201001240')
    expect(listingKey('https://www.canadacomputers.com/en/gaming-chair/251373/dragonwar-ergonomic-gaming-chair-gc-023.html')).toBe('canadacomputers.com/251373')
    expect(listingKey('https://www.canadacomputers.com/')).toBeNull()
    expect(listingKey('https://www.visions.ca/shop/category/computers-home-office-accessories/office-furniture/gaming-chairs')).toBeNull()
    expect(listingKey('https://www.visions.ca/cougar-armor-one-v2-black-orange-gaming-chair-armoronev2')).toBeNull()
  })

  it('strips colour and edition words and keeps model numbers', () => {
    expect(parseOfferName('Cybeart NEO (Stealth Edition)').identityKey).toBe('cybeart neo')
    expect(parseOfferName('Cybeart NEO (Lunar Edition)').variantLabel).toBe('Lunar')
    expect(parseOfferName('Cybeart APEX Gryffindor Edition Gaming Chair').identityKey).toBe('cybeart apex')
    expect(parseOfferName('Anda Seat Phantom 4 Premium Gaming Chair Red (AD18-57-B-PVF-R01)').identityKey).toBe('anda seat phantom 4')
    expect(parseOfferName('Anda Seat Phantom 3').identityKey).toBe('anda seat phantom 3')
    expect(parseOfferName('SIHOO B100 PRO').identityKey).toBe('sihoo b100 pro')
    expect(parseOfferName('SIHOO B300 PRO').identityKey).toBe('sihoo b300 pro')
    expect(parseOfferName('DragonWar Ergonomic Gaming Chair GC-019 (PU)').identityKey).toBe('dragonwar gc-019')
    expect(parseOfferName('DragonWar Ergonomic Gaming Chair GC-023').identityKey).toBe('dragonwar gc-023')
  })

  it('merges Cybeart NEO colourways and keeps a different model apart', () => {
    const lunar = snap(1, 'Cybeart NEO (Lunar Edition)', { product_url: 'https://www.amazon.ca/dp/B0F62K8T2Z' })
    const stealth = snap(2, 'Cybeart NEO (Stealth Edition)', { product_url: 'https://www.amazon.ca/dp/B0GFF1ZQGY' })
    const costcoNeo = snap(3, 'Cybeart NEO', {
      store_id: 'costco',
      price: 299.99,
      in_stock: false,
      product_url: 'https://www.costco.ca/p/-/cybeart-neo-office-and-gaming-chair/4201001240',
    })
    const apex = snap(4, 'Cybeart APEX Gryffindor Edition Gaming Chair', { product_url: 'https://www.amazon.ca/dp/B0CXJ78CNJ', price: 449.99 })
    const quotes = offerQuotes([lunar, stealth, costcoNeo, apex], [amazon, costco])
    const amazonNeo = quotes.find((quote) => quote.storeId === 'amazon' && quote.productName === 'Cybeart NEO')
    expect(quotes.filter((quote) => quote.storeId === 'amazon' && quote.price === 429.99)).toHaveLength(1)
    expect(amazonNeo?.variantHeading).toBe('Colours')
    expect(amazonNeo?.variants.map((variant) => variant.label).sort()).toEqual(['Lunar', 'Stealth'])
    expect(amazonNeo?.price).toBe(429.99)
    expect(quotes.find((quote) => quote.storeId === 'costco')?.productName).toBe('Cybeart NEO')
    expect(quotes.some((quote) => quote.productName?.includes('APEX'))).toBe(true)
    const cybeartKeys = new Set([...assignProducts([lunar, stealth, costcoNeo, apex]).values()].map((row) => row.productKey).filter((key) => key.includes('cybeart')))
    expect(cybeartKeys.size).toBe(2)
  })

  it('does not let a cheaper out-of-stock colour set the offer price', () => {
    const lunar = snap(1, 'Cybeart NEO (Lunar Edition)', { product_url: 'https://www.amazon.ca/dp/B0F62K8T2Z', price: 429.99, in_stock: true })
    const stealth = snap(2, 'Cybeart NEO (Stealth Edition)', { product_url: 'https://www.amazon.ca/dp/B0GFF1ZQGY', price: 300, in_stock: false })
    const quote = offerQuotes([lunar, stealth], [amazon])[0]
    expect(quote?.price).toBe(429.99)
    expect(quote?.inStock).not.toBe(false)
    expect(quote?.variants).toHaveLength(2)
    const rows = compareStores([quote!], [], quote!.snapshotId)
    expect(rows[0]?.price).toBe(429.99)
    expect(rows[0]?.variants.map((variant) => variant.label).sort()).toEqual(['Lunar', 'Stealth'])
  })

  it('keeps Phantom 3 and Phantom 4, B100 and B300, and GC-019 and GC-023 apart', () => {
    const rows = [
      snap(1, 'Anda Seat Phantom 3'),
      snap(2, 'Anda Seat Phantom 4 Premium Gaming Chair Red (AD18-57-B-PVF-R01)'),
      snap(3, 'SIHOO B100 PRO', { product_url: 'https://www.amazon.ca/dp/B0HB72WC3F' }),
      snap(4, 'SIHOO B300 PRO', { product_url: 'https://www.amazon.ca/dp/B0GXB29CD9' }),
      snap(5, 'DragonWar Ergonomic Gaming Chair GC-019 (PU)'),
      snap(6, 'DragonWar Ergonomic Gaming Chair GC-023'),
      snap(7, 'BLACKLYTE Athena Pro Team Liquid Blue', { product_url: 'https://www.amazon.ca/dp/B0H5VCFXNQ' }),
      snap(8, 'BLACKLYTE Athena Pro Wuchang', { product_url: 'https://www.amazon.ca/dp/B0FX3T4M7V' }),
      snap(9, 'Cougar Armor Elite', { product_url: 'https://www.amazon.ca/dp/B0CGVMJSJ4' }),
      snap(10, 'Cougar Armor One V2'),
    ]
    const keys = assignProducts(rows)
    const key = (id: number) => keys.get(id)?.productKey
    expect(key(1)).not.toBe(key(2))
    expect(key(3)).not.toBe(key(4))
    expect(key(5)).not.toBe(key(6))
    expect(key(7)).not.toBe(key(8))
    expect(key(9)).not.toBe(key(10))
    expect(offerQuotes(rows, [amazon])).toHaveLength(10)
  })

  it('collapses same-SKU renames to the latest price and still merges wording variants', () => {
    const quartz = snap(1, 'Razer Iskur V2 X NewGen Quartz', {
      product_url: 'https://www.amazon.ca/dp/B0GFPP6YL5',
      price: 329.99,
      meets_requirements: false,
      captured_at: '2026-10-22T22:34:57.000Z',
    })
    const renamed = snap(2, 'Razer Iskur V2 X NewGen', {
      product_url: 'https://www.amazon.ca/dp/B0GFPP6YL5',
      price: 499.99,
      meets_requirements: false,
      captured_at: '2026-10-23T16:20:43.000Z',
    })
    const b100 = snap(3, 'SIHOO B100 PRO', { product_url: 'https://www.amazon.ca/dp/B0HB72WC3F', price: 289.99 })
    const b100Alias = snap(4, 'Sihoo B100 PRO / M18 Ergonomic Chair', { product_url: 'https://www.amazon.ca/dp/B0HB72WC3F', price: 339.99, captured_at: '2026-10-22T22:12:08.000Z' })
    const hyken = snap(5, 'Staples Hyken XL', { store_id: 'staples', product_url: 'https://www.staples.ca/products/3114224-en-staples-hyken-xl' })
    const hykenLong = snap(6, 'Staples Hyken XL Ergonomic Fabric Swivel Big & Tall Chair Black', {
      store_id: 'staples',
      product_url: 'https://www.staples.ca/products/3114224-en-staples-hyken-xl-ergonomic-fabric-swivel-big-tall-chair-black',
      captured_at: '2026-10-22T22:12:08.000Z',
    })
    const armor = snap(7, 'Cougar Armor One V2', { store_id: 'visions', captured_at: '2026-10-23T16:20:43.000Z' })
    const armorLong = snap(8, 'Cougar Armor One V2 Gaming Chair (ARMORONEV2)', {
      store_id: 'visions',
      product_url: 'https://www.visions.ca/cougar-armor-one-v2-black-orange-gaming-chair-armoronev2',
      captured_at: '2026-10-22T22:12:08.000Z',
    })
    const darkKnight = snap(9, 'Anda Seat Dark Knight', { store_id: 'bestbuy' })
    const darkKnightLong = snap(10, 'Anda Seat Dark Knight Premium Black Office Chair', { store_id: 'costco' })
    const quotes = offerQuotes([quartz, renamed, b100, b100Alias, hyken, hykenLong, armor, armorLong, darkKnight, darkKnightLong], [amazon, costco, visions])
    const razer = quotes.filter((quote) => quote.productName?.toLowerCase().includes('iskur'))
    expect(razer).toHaveLength(1)
    expect(razer[0]?.price).toBe(499.99)
    expect(razer[0]?.variants).toHaveLength(1)
    expect(quotes.filter((quote) => quote.productName?.toLowerCase().includes('b100'))).toHaveLength(1)
    expect(quotes.filter((quote) => quote.storeId === 'staples')).toHaveLength(1)
    expect(quotes.filter((quote) => quote.storeId === 'visions' && quote.productName?.toLowerCase().includes('armor one'))).toHaveLength(1)
    const knightKeys = assignProducts([darkKnight, darkKnightLong])
    expect(knightKeys.get(9)?.productKey).toBe(knightKeys.get(10)?.productKey)
  })

  it('plots colourways as one series and does not treat another model as a price change', () => {
    const lunar = snap(2, 'Cybeart NEO (Lunar Edition)', { product_url: 'https://www.amazon.ca/dp/B0F62K8T2Z', price: 429.99, captured_at: '2026-10-23T14:00:00.000Z' })
    const stealth = snap(1, 'Cybeart NEO (Stealth Edition)', { product_url: 'https://www.amazon.ca/dp/B0GFF1ZQGY', price: 429.99, captured_at: '2026-10-23T12:00:00.000Z' })
    const history = buildPriceHistory([lunar, stealth], [amazon])
    expect(history.series).toHaveLength(1)
    expect(history.series[0]?.name).toBe('Amazon · Cybeart NEO')
    expect(history.rows).toHaveLength(1)
    expect(Object.values(history.rows[0] ?? {}).filter((value) => value === 429.99)).toHaveLength(1)

    const samePrice = buildTimeline({ items: [item], stores: [amazon], snapshots: [stealth, lunar], deals: [] })
    expect(samePrice).toEqual([])

    const phantom3 = snap(3, 'Anda Seat Phantom 3', { price: 100, captured_at: '2026-10-21T12:00:00.000Z' })
    const phantom4 = snap(4, 'Anda Seat Phantom 4', { price: 150, captured_at: '2026-10-23T12:00:00.000Z' })
    expect(buildTimeline({ items: [item], stores: [amazon], snapshots: [phantom3, phantom4], deals: [] })).toEqual([])

    const dropped = snap(5, 'Cybeart NEO (Lunar Edition)', { product_url: 'https://www.amazon.ca/dp/B0F62K8T2Z', price: 400, captured_at: '2026-10-23T18:00:00.000Z' })
    const earlier = snap(6, 'Cybeart NEO (Stealth Edition)', { product_url: 'https://www.amazon.ca/dp/B0GFF1ZQGY', price: 450, captured_at: '2026-10-22T18:00:00.000Z' })
    const events = buildTimeline({ items: [item], stores: [amazon], snapshots: [earlier, dropped], deals: [] })
    expect(events.map((event) => event.kind)).toEqual(['new_low'])
    expect(events[0]?.productName).toContain('Cybeart NEO')
    expect(events[0]?.productName).toContain('Lunar')
  })

  it('counts one observation per product per store per day and one deal per colourway family', () => {
    const lunar = snap(1, 'Cybeart NEO (Lunar Edition)', { product_url: 'https://www.amazon.ca/dp/B0F62K8T2Z', captured_at: now.toISOString() })
    const stealth = snap(2, 'Cybeart NEO (Stealth Edition)', { product_url: 'https://www.amazon.ca/dp/B0GFF1ZQGY', captured_at: now.toISOString() })
    const model = computeAnalytics(
      { items: [item], stores: [amazon], snapshots: [lunar, stealth], deals: [] },
      { preset: '30d', category: null, storeId: null, now, includeTargets: false },
    )
    expect(model.storeStats.find((store) => store.storeId === 'amazon')?.observations).toBe(1)

    const clusters = clusterDeals([
      deal('stealth', 'Cybeart NEO (Stealth Edition)', 429.99),
      deal('lunar', 'Cybeart NEO (Lunar Edition)', 419.99),
      deal('gc19', 'DragonWar Ergonomic Gaming Chair GC-019 (PU)', 135.88),
      deal('gc23', 'DragonWar Ergonomic Gaming Chair GC-023', 135.88),
      deal('p3', 'Anda Seat Phantom 3', 300),
      deal('p4', 'Anda Seat Phantom 4', 348),
    ], [])
    expect(clusters).toHaveLength(5)
    const neo = clusters.find((cluster) => cluster.deal.title.includes('NEO'))
    expect(neo?.deal.price).toBe(419.99)
    expect(neo?.options.map((option) => option.label).sort()).toEqual(['Lunar', 'Stealth'])
  })
})
