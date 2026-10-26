import type { Dataset, Deal, Item, PriceSnapshot, Priority, Store, Verdict } from '../domain/types'
import { dayKey } from '../domain/format'

const stores: Store[] = [
  store('costco', 'Costco', 'https://www.costco.ca', 'Executive'),
  store('amazon', 'Amazon', 'https://www.amazon.ca', 'Prime'),
  store('walmart', 'Walmart', 'https://www.walmart.ca', null),
  store('cc', 'Canada Computers', 'https://www.canadacomputers.com', null),
  store('bestbuy', 'Best Buy', 'https://www.bestbuy.ca', null),
  store('staples', 'Staples', 'https://www.staples.ca', null),
  store('visions', 'Visions Electronics', 'https://www.visions.ca', null),
]

export function createPreviewDataset(now = new Date()): Dataset {
  const today = dayKey(now.toISOString())
  const ids = { next: 1 }
  const nextId = () => {
    ids.next += 1
    return ids.next
  }
  const items: Item[] = [
    item('tv', '65" OLED TV', 'Electronics', ['oled', 'lg'], 1800, 2200, 'high', true, 'Living room. Prefer a current-year panel.', today),
    item('keys', 'Mechanical keyboard', 'Electronics', ['keyboard'], 180, 220, 'normal', true, null, today),
    item('tires', 'Winter tire set', 'Auto', ['tires', 'winter'], 900, 1100, 'high', true, '225/55R17, installed if the price is close.', today),
    item('oil', 'Olive oil, 2 L', 'Grocery', ['costco'], 18, 24, 'low', true, null, today),
    item('phones', 'Noise-cancelling headphones', 'Electronics', ['headphones'], 280, 350, 'normal', true, null, today),
    item('air', 'Air purifier', 'Home', ['hepa'], 250, 320, 'normal', false, 'Paused until smoke season.', today),
    item('monitor', '27" monitor', 'Electronics', ['usb-c'], 400, 500, 'normal', true, 'No prices recorded yet.', today),
    item('chair', 'Ergonomic chair', 'Chairs', ['chair'], 400, 500, 'high', true, null, today),
    item('stool', 'Drafting stool', 'Chairs', ['stool'], 180, 240, 'normal', true, null, today),
  ]
  const chair = items.find((entry) => entry.id === 'chair')
  if (chair) {
    chair.specs = [
      { name: 'Tilt', value: 'Frog' },
      { name: 'Weight rating', value: '150 kg' },
    ]
    chair.requirements = [{ label: 'true frog tilt' }, { label: '150 kg rating' }]
  }
  const keyboard = items.find((entry) => entry.id === 'keys')
  if (keyboard) {
    keyboard.specs = [
      { name: 'Switch', value: 'Hot-swap mechanical' },
      { name: 'Layout', value: '75%' },
      { name: 'Connection', value: 'USB-C' },
    ]
    keyboard.requirements = [
      { label: 'Hot-swap' },
      { label: 'Aluminum case' },
    ]
  }
  const snapshots: PriceSnapshot[] = [
    ...walk(nextId, 'tv', 'bestbuy', 70, 4, 2499, 1899, 2499, 'LG C4 65"', 'https://www.bestbuy.ca/oled', false, today),
    ...walk(nextId, 'tv', 'costco', 70, 5, 2299, 1999, 2499, 'LG OLED 65"', 'https://www.costco.ca/oled', true, today),
    ...walk(nextId, 'tv', 'amazon', 70, 4, 2399, 2099, 2499, 'LG C4', 'https://www.amazon.ca/oled', true, today),
    ...walk(nextId, 'tv', 'visions', 60, 6, 2449, 1949, 2599, 'LG OLED', 'https://www.visions.ca/oled', false, today),
    ...walk(nextId, 'tv', 'walmart', 40, 8, 2599, 2299, 2599, '65 inch OLED', 'https://www.walmart.ca/oled', false, today),
    ...walk(nextId, 'keys', 'cc', 50, 5, 219, 169, 229, 'Keychron Q1', 'https://www.canadacomputers.com/keychron', false, today),
    ...walk(nextId, 'keys', 'amazon', 50, 6, 199, 189, 219, 'Keychron Q1', 'https://www.amazon.ca/keychron', true, today),
    ...walk(nextId, 'keys', 'staples', 30, 10, 229, 209, 229, 'Mechanical keyboard', 'https://www.staples.ca/keyboard', false, today),
    ...walk(nextId, 'tires', 'costco', 80, 7, 1049, 949, 1199, 'Michelin X-Ice, set of 4', 'https://www.costco.ca/tires', true, today),
    ...walk(nextId, 'tires', 'walmart', 40, 10, 999, 979, 1099, 'Winter tire set', 'https://www.walmart.ca/tires', false, today),
    ...walk(nextId, 'oil', 'costco', 60, 6, 21.99, 16.49, 22.99, 'Kirkland Signature olive oil 2 L', 'https://www.costco.ca/olive-oil', true, today),
    ...walk(nextId, 'oil', 'walmart', 40, 8, 24.97, 19.97, 24.97, 'Olive oil 2 L', 'https://www.walmart.ca/olive-oil', false, today),
    ...walk(nextId, 'phones', 'amazon', 55, 5, 399, 279, 449, 'Sony WH-1000XM5', 'https://www.amazon.ca/wh1000xm5', true, today),
    ...walk(nextId, 'phones', 'bestbuy', 55, 5, 449, 329, 449, 'Sony WH-1000XM5', 'https://www.bestbuy.ca/wh1000xm5', false, today),
    ...walk(nextId, 'phones', 'staples', 20, 7, 399, 349, 399, 'Sony headphones', 'https://www.staples.ca/sony', false, today, false),
    ...walk(nextId, 'air', 'costco', 90, 10, 329, 279, 349, 'Winix air purifier', 'https://www.costco.ca/winix', true, today),
    ...walk(nextId, 'air', 'amazon', 40, 8, 299, 269, 329, 'Winix purifier', 'https://www.amazon.ca/winix', true, today),
    ...walk(nextId, 'chair', 'costco', 4, 4, 399, 349, 449, 'Heavy-duty chair, frog tilt', 'https://www.costco.ca/chair', true, today),
    ...marked(walk(nextId, 'chair', 'cc', 0, 1, 195.89, 195.89, 249, 'Basic office chair', 'https://www.canadacomputers.com/chair', false, today), false),
    ...marked(walk(nextId, 'chair', 'amazon', 1, 1, 121.88, 121.88, 199, 'Compact task chair', 'https://www.amazon.ca/chair', true, today), false),
    ...marked(walk(nextId, 'chair', 'bestbuy', 0, 1, 250, 250, 300, 'Listing still being checked', 'https://www.bestbuy.ca/chair', false, today), null),
    ...marked(walk(nextId, 'stool', 'cc', 0, 1, 99, 99, 140, 'Short stool', 'https://www.canadacomputers.com/stool', false, today), false),
    ...marked(walk(nextId, 'stool', 'walmart', 0, 1, 120, 120, 150, 'Drafting stool listing', 'https://www.walmart.ca/stool', false, today), null),
  ]
  const deals: Deal[] = [
    deal('d-tv', 'tv', 'bestbuy', 'LG C4 below target', 'https://www.bestbuy.ca/oled', 1899, 2499, 92, 'must_buy', 'Under target and near the lowest price recorded.', 'open', 1, today),
    deal('d-phones', 'phones', 'amazon', 'XM5 member price', 'https://www.amazon.ca/wh1000xm5', 279, 449, 74, 'good', 'Prime price is under target with a wide gap to regular.', 'open', 2, today),
    deal('d-keys', 'keys', 'cc', 'Keychron at Canada Computers', 'https://www.canadacomputers.com/keychron', 169, 229, 55, 'ok', 'Under target, though the discount is modest.', 'open', 3, today),
    deal('d-oil', 'oil', 'costco', 'Kirkland olive oil', 'https://www.costco.ca/olive-oil', 16.49, 22.99, 22, 'skip', 'Only a few dollars under target.', 'open', 4, today),
    deal('d-tires', 'tires', 'costco', 'Michelin winter set', 'https://www.costco.ca/tires', 949, 1199, 81, 'good', 'Bought at the last drop.', 'bought', 12, today),
    deal('d-air', 'air', 'amazon', 'Winix on Prime', 'https://www.amazon.ca/winix', 269, 329, 48, 'ok', 'Dismissed until the season turns.', 'dismissed', 20, today),
    deal('d-old', 'tv', 'walmart', 'Walmart OLED', 'https://www.walmart.ca/oled', 2399, 2599, 30, 'skip', 'The listing expired.', 'expired', 40, today),
  ]
  return { items, stores, snapshots, deals }
}

function store(id: string, name: string, baseUrl: string, membership: string | null): Store {
  return {
    id,
    name,
    base_url: baseUrl,
    country: 'CA',
    country_code: 'CA',
    membership,
    notes: null,
    enabled: true,
    created_at: '2026-10-01T16:00:00.000Z',
    updated_at: '2026-10-01T16:00:00.000Z',
  }
}

function item(
  id: string,
  name: string,
  category: string,
  keywords: string[],
  target: number,
  max: number,
  priority: Priority,
  active: boolean,
  notes: string | null,
  today: string,
): Item {
  return {
    id,
    name,
    public_summary: `${name} at Canadian stores.`,
    description: null,
    category,
    keywords,
    target_price: target,
    max_price: max,
    priority,
    condition: 'new',
    notes,
    image_url: null,
    specs: [],
    requirements: [],
    product_url: null,
    enrichment_status: 'ready',
    active,
    created_at: `${shift(today, 80)}T16:00:00.000Z`,
    updated_at: `${today}T16:00:00.000Z`,
  }
}

function marked(snapshots: PriceSnapshot[], meets: boolean | null): PriceSnapshot[] {
  return snapshots.map((snapshot) => ({ ...snapshot, meets_requirements: meets }))
}

function walk(
  nextId: () => number,
  itemId: string,
  storeId: string,
  startDaysAgo: number,
  every: number,
  startPrice: number,
  endPrice: number,
  regular: number,
  title: string,
  url: string,
  memberOnly: boolean,
  today: string,
  inStock = true,
): PriceSnapshot[] {
  const snapshots: PriceSnapshot[] = []
  const steps = Math.floor(startDaysAgo / every)
  for (let step = 0; step <= steps; step += 1) {
    const daysAgo = startDaysAgo - step * every
    const t = steps === 0 ? 1 : step / steps
    const price = Math.round((startPrice + (endPrice - startPrice) * t) * 100) / 100
    snapshots.push({
      id: nextId(),
      item_id: itemId,
      store_id: storeId,
      product_title: title,
      product_url: url,
      price,
      regular_price: regular,
      currency: 'CAD',
      in_stock: inStock || daysAgo > 0,
      member_only: memberOnly,
      captured_at: `${shift(today, daysAgo)}T16:00:00.000Z`,
      sale_ends_at: null,
      shipping: null,
      product_name: title,
      meets_requirements: true,
    })
  }
  return snapshots
}

function deal(
  id: string,
  itemId: string,
  storeId: string,
  title: string,
  url: string,
  price: number,
  regular: number,
  score: number,
  verdict: Verdict,
  reason: string,
  status: Deal['status'],
  daysAgo: number,
  today: string,
): Deal {
  return {
    id,
    item_id: itemId,
    store_id: storeId,
    snapshot_id: null,
    title,
    url,
    price,
    regular_price: regular,
    discount_pct: Math.round(((regular - price) / regular) * 10000) / 100,
    score,
    verdict,
    reason,
    notified_at: status === 'open' ? `${shift(today, daysAgo)}T16:00:00.000Z` : null,
    expires_at: null,
    status,
    found_at: `${shift(today, daysAgo)}T16:00:00.000Z`,
  }
}

function shift(day: string, daysAgo: number): string {
  const [year, month, date] = day.split('-').map(Number)
  const utc = new Date(Date.UTC(year ?? 2026, (month ?? 1) - 1, date ?? 1))
  utc.setUTCDate(utc.getUTCDate() - daysAgo)
  return utc.toISOString().slice(0, 10)
}
