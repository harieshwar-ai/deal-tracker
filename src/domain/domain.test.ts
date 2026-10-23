import { describe, expect, it } from 'vitest'
import { computeAnalytics } from './analytics'
import { groupDeals, pickOpenDeal } from './deals'
import { parseItemDraft, parseStoreDraft, pendingItemFromUrl } from './drafts'
import { dayKey, discountPercent, formatCad, safeHttpUrl } from './format'
import { buildPriceHistory, historyChartState } from './history'
import { withoutItem, withoutStore } from './mutate'
import { allTimeLow, chooseBest, latestSnapshots, quoteFromSnapshot } from './quotes'
import type { Quote } from './quotes'
import type { Dataset, Deal, Item, PriceSnapshot, Priority, Store } from './types'
import { buildWatchRows, filterWatchRows, sortWatchRows } from './watchlist'
import { parseItemRow } from '../data/parse'
import { friendlyError } from '../data/parse'
import { createPreviewDataset } from '../preview/fixtures'
import { writeParams } from '../lib/search'

const now = new Date('2026-10-22T16:00:00.000Z')

function daysAgo(days: number): string {
  return new Date(now.getTime() - days * 86400000).toISOString()
}

function makeStore(id: string, name: string): Store {
  return {
    id,
    name,
    base_url: `https://${id}.example`,
    country: 'CA',
    membership: null,
    notes: null,
    enabled: true,
    created_at: daysAgo(10),
    updated_at: daysAgo(10),
  }
}

function makeItem(id: string, name: string, category: string, target: number, priority: Priority = 'normal'): Item {
  return {
    id,
    name,
    public_summary: null,
    description: null,
    category,
    keywords: [name.split(' ')[0]?.toLowerCase() ?? 'item'],
    target_price: target,
    max_price: null,
    priority,
    condition: 'new',
    notes: null,
    image_url: null,
    specs: [],
    requirements: [],
    product_url: null,
    enrichment_status: 'ready',
    active: true,
    created_at: daysAgo(20),
    updated_at: daysAgo(1),
  }
}

function makeSnapshot(
  id: number,
  itemId: string,
  storeId: string | null,
  price: number,
  days: number,
  regular: number | null = null,
  extra: Partial<PriceSnapshot> = {},
): PriceSnapshot {
  return {
    id,
    item_id: itemId,
    store_id: storeId,
    product_title: null,
    product_url: null,
    price,
    regular_price: regular,
    currency: 'CAD',
    in_stock: true,
    member_only: false,
    captured_at: daysAgo(days),
    sale_ends_at: null,
    shipping: null,
    product_name: null,
    meets_requirements: true,
    ...extra,
  }
}

function makeDeal(partial: Partial<Deal> & Pick<Deal, 'id' | 'item_id' | 'status'>): Deal {
  return {
    store_id: 'costco',
    snapshot_id: null,
    title: partial.id,
    url: null,
    price: 10,
    regular_price: 12,
    discount_pct: null,
    score: 50,
    verdict: 'good',
    reason: null,
    notified_at: null,
    expires_at: null,
    found_at: daysAgo(1),
    ...partial,
  }
}

function sample(): Dataset {
  return {
    stores: [makeStore('costco', 'Costco'), makeStore('amazon', 'Amazon')],
    items: [
      makeItem('tv', 'OLED TV', 'Electronics', 2000, 'high'),
      makeItem('oil', 'Olive oil', 'Grocery', 20, 'low'),
    ],
    snapshots: [
      makeSnapshot(1, 'tv', 'costco', 2200, 10, 2400),
      makeSnapshot(2, 'tv', 'amazon', 2000, 10, 2400),
      makeSnapshot(3, 'tv', 'costco', 1900, 0, 2400),
      makeSnapshot(4, 'tv', 'amazon', 2100, 0, 2400),
      makeSnapshot(5, 'tv', 'amazon', 100, 0, null, { currency: 'USD' }),
      makeSnapshot(6, 'oil', 'costco', 18, 40, 22),
      makeSnapshot(7, 'oil', 'costco', 16, 0, 22),
    ],
    deals: [
      makeDeal({ id: 'open-tv', item_id: 'tv', status: 'open', verdict: 'must_buy', score: 90, found_at: daysAgo(0), store_id: 'costco' }),
      makeDeal({ id: 'open-oil', item_id: 'oil', status: 'open', verdict: 'good', score: 40, found_at: daysAgo(0) }),
      makeDeal({ id: 'bought', item_id: 'tv', status: 'bought', verdict: 'good', score: 70, found_at: daysAgo(20) }),
      makeDeal({ id: 'old', item_id: 'tv', status: 'open', verdict: 'skip', score: 10, found_at: daysAgo(100) }),
    ],
  }
}

describe('search params', () => {
  it('keeps an explicit all filter and drops empty values', () => {
    const next = writeParams(new URLSearchParams('priority=high'), {
      activity: 'all',
      range: 'all',
      status: null,
      q: '',
    })
    expect(next.get('activity')).toBe('all')
    expect(next.get('range')).toBe('all')
    expect(next.get('status')).toBeNull()
    expect(next.get('q')).toBeNull()
    expect(next.get('priority')).toBe('high')
  })
})

describe('format', () => {
  it('formats CAD and calendar days in Toronto', () => {
    expect(formatCad(12)).toMatch(/12\.00/)
    expect(formatCad(null)).toBe('—')
    expect(dayKey('2026-01-15T04:30:00.000Z')).toBe('2026-01-14')
    expect(dayKey('2026-01-15T05:00:00.000Z')).toBe('2026-01-15')
  })

  it('accepts only http(s) links and computes discount from prices', () => {
    expect(safeHttpUrl('https://www.bestbuy.ca/tv')).toBe('https://www.bestbuy.ca/tv')
    expect(safeHttpUrl('javascript:alert(1)')).toBeNull()
    expect(discountPercent(80, 100)).toBe(20)
    expect(discountPercent(80, null)).toBeNull()
  })
})

describe('drafts and rows', () => {
  it('parses item and store drafts', () => {
    const item = parseItemDraft({
      name: '  TV  ',
      publicSummary: 'A television.',
      description: '',
      category: 'Electronics',
      keywords: 'OLED, oled, 4K',
      targetPrice: '1800',
      maxPrice: '',
      priority: 'high',
      condition: '',
      notes: '',
      imageUrl: '',
      specs: 'Panel | OLED',
      requirements: 'OLED panel',
      productUrl: '',
      enrichmentStatus: 'ready',
      active: true,
    })
    expect(item.ok).toBe(true)
    if (item.ok) {
      expect(item.value.name).toBe('TV')
      expect(item.value.keywords).toEqual(['OLED', '4K'])
      expect(item.value.condition).toBe('new')
      expect(item.value.target_price).toBe(1800)
      expect(item.value.public_summary).toBe('A television.')
      expect(item.value.specs).toEqual([{ name: 'Panel', value: 'OLED' }])
      expect(item.value.requirements).toEqual([{ label: 'OLED panel' }])
    }
    expect(parseItemDraft({ ...blankish(), name: ' ', targetPrice: '12.345' }).ok).toBe(false)
    const pending = pendingItemFromUrl('https://www.bestbuy.ca/en-ca/product/chair/123')
    expect(pending.ok).toBe(true)
    if (pending.ok) {
      expect(pending.value.enrichment_status).toBe('pending_enrichment')
      expect(pending.value.name).toBe('Pending · bestbuy.ca')
      expect(pending.value.product_url).toMatch(/^https:\/\/www\.bestbuy\.ca\//)
      expect(pending.value.public_summary).toBeNull()
      expect(pending.value.notes).toBeNull()
    }
    expect(pendingItemFromUrl('javascript:alert(1)').ok).toBe(false)
    const store = parseStoreDraft({
      name: 'Best Buy',
      baseUrl: 'javascript:alert(1)',
      country: '',
      membership: '',
      notes: '',
      enabled: true,
    })
    expect(store.ok).toBe(false)
  })

  it('coerces numeric strings from PostgREST', () => {
    const row = parseItemRow({
      id: 'item-1',
      name: 'TV',
      description: null,
      category: null,
      keywords: null,
      target_price: '19.99',
      max_price: null,
      priority: 'normal',
      condition: 'new',
      notes: null,
      active: true,
      created_at: daysAgo(1),
      updated_at: daysAgo(1),
    })
    expect(row.target_price).toBe(19.99)
    expect(row.keywords).toEqual([])
    expect(() => parseItemRow({ ...row, priority: 'urgent' })).toThrow(/Invalid items row/)
    expect(friendlyError({ code: '23505', message: 'duplicate' })).toMatch(/already exists/)
  })
})

describe('quotes and watchlist', () => {
  const stores = [makeStore('costco', 'Costco'), makeStore('amazon', 'Amazon')]

  it('keeps the newest snapshot and skips out-of-stock prices when another store can sell', () => {
    const snapshots = [
      makeSnapshot(1, 'tv', 'costco', 100, 2),
      makeSnapshot(2, 'tv', 'costco', 90, 1),
      makeSnapshot(3, 'tv', 'costco', 80, 1),
    ]
    const latest = latestSnapshots(snapshots)
    expect(latest).toHaveLength(1)
    expect(latest[0]?.id).toBe(3)
    const quotes: Quote[] = [
      { ...quoteFromSnapshot(makeSnapshot(1, 'tv', 'costco', 10, 0, null, { in_stock: false }), stores) },
      { ...quoteFromSnapshot(makeSnapshot(2, 'tv', 'amazon', 12, 0), stores) },
    ]
    expect(chooseBest(quotes)?.storeId).toBe('amazon')
    expect(chooseBest(quotes.slice(0, 1))?.storeId).toBe('costco')
  })

  it('builds sparkline, badges, and target-gap sort', () => {
    const data = sample()
    const rows = buildWatchRows(data, now)
    const tv = rows.find((row) => row.item.id === 'tv')
    expect(tv?.best?.price).toBe(1900)
    expect(tv?.best?.storeName).toBe('Costco')
    expect(tv?.openDeal?.verdict).toBe('must_buy')
    expect(tv?.atLow).toBe(true)
    expect(tv?.spark[0]).toBe(2000)
    expect(tv?.spark.at(-1)).toBe(1900)
    const filtered = filterWatchRows(rows, {
      query: 'oled',
      category: null,
      priority: 'all',
      activity: 'active',
      sort: 'name',
    })
    expect(filtered.map((row) => row.item.id)).toEqual(['tv'])
    const sorted = sortWatchRows(rows, 'target_gap')
    expect(sorted[0]?.item.id).toBe('tv')
    expect(pickOpenDeal(data.deals.filter((deal) => deal.item_id === 'tv'))?.id).toBe('open-tv')
  })

  it('groups deals by verdict and score', () => {
    const groups = groupDeals(sample().deals)
    expect(groups.map((group) => group.verdict)).toEqual(['must_buy', 'good', 'skip'])
    const good = groups.find((group) => group.verdict === 'good')
    expect(good?.deals.map((deal) => deal.id)).toEqual(['bought', 'open-oil'])
  })
})

describe('analytics', () => {
  it('summarises an empty watchlist', () => {
    const model = computeAnalytics({ items: [], stores: [], snapshots: [], deals: [] }, { preset: '90d', category: null, storeId: null, now })
    expect(model.itemCount).toBe(0)
    expect(model.insight).toMatch(/watchlist/i)
  })

  it('compares stores, targets, and all-time lows for the last 30 days', () => {
    const model = computeAnalytics(sample(), { preset: '30d', category: null, storeId: null, now })
    expect(model.pricedItemCount).toBe(2)
    expect(model.underTargetCount).toBe(2)
    expect(model.underTargetSavings).toBe(104)
    expect(model.regularSavings).toBe(506)
    expect(model.openDealCount).toBe(3)
    expect(model.dealsInPeriod).toBe(3)
    expect(model.excludedCurrencyCount).toBe(1)
    expect(model.itemDays).toBe(3)
    const costco = model.storeStats.find((store) => store.storeId === 'costco')
    const amazon = model.storeStats.find((store) => store.storeId === 'amazon')
    expect(costco?.wins).toBe(2)
    expect(amazon?.wins).toBe(1)
    expect(model.priceIndex).toHaveLength(2)
    expect(model.priceIndex[0]?.index).toBeCloseTo(100)
    expect(model.priceIndex[1]?.index).toBeCloseTo(97.5)
    expect(model.savingsByDate.map((point) => point.savings)).toEqual([400, 506])
    expect(model.atLowCount).toBe(2)
    expect(model.allTimeLows.every((row) => row.atLow)).toBe(true)
    expect(model.scoreBuckets.find((bucket) => bucket.label === '80–100')?.count).toBe(1)
    expect(model.categories.map((category) => category.category).sort()).toEqual(['Electronics', 'Grocery'])
    expect(model.insight).toMatch(/Costco/)
    expect(model.dealFlowGrain).toBe('day')
  })

  it('leaves targets out of the public summary', () => {
    const model = computeAnalytics(sample(), { preset: '30d', category: null, storeId: null, now, includeTargets: false })
    expect(model.underTargetCount).toBe(0)
    expect(model.regularSavings).toBe(506)
    expect(model.atLowCount).toBe(2)
    expect(model.insight.toLowerCase()).not.toContain('target')
    expect(model.insight).toMatch(/regular/)
    expect(model.categories.every((entry) => entry.underTarget === 0)).toBe(true)
  })

  it('respects category and store filters without letting another currency set the low', () => {
    const amazonOnly = computeAnalytics(sample(), { preset: '30d', category: null, storeId: 'amazon', now })
    expect(amazonOnly.pricedItemCount).toBe(1)
    expect(amazonOnly.underTargetCount).toBe(0)
    expect(amazonOnly.allTimeLows[0]?.atlPrice).toBe(2000)
    const grocery = computeAnalytics(sample(), { preset: 'all', category: 'Grocery', storeId: null, now })
    expect(grocery.itemCount).toBe(1)
    expect(grocery.allTimeLows[0]?.atlPrice).toBe(16)
    const low = allTimeLow(sample().snapshots.filter((snapshot) => snapshot.item_id === 'tv'))
    expect(low?.price).toBe(1900)
  })
})

describe('history, preview, and deletes', () => {
  it('plots one point per store per day', () => {
    const history = buildPriceHistory(
      sample().snapshots.filter((snapshot) => snapshot.item_id === 'tv'),
      sample().stores,
    )
    const today = dayKey(daysAgo(0))
    const row = history.rows.find((entry) => entry.date === today)
    expect(row?.costco).toBe(1900)
    expect(row?.amazon).toBe(2100)
    expect(historyChartState(0)).toBe('empty')
    expect(historyChartState(1)).toBe('points')
    expect(historyChartState(4)).toBe('points')
    expect(historyChartState(5)).toBe('ready')
    expect(history.rows.length).toBeGreaterThan(0)
  })

  it('builds a connected sample and detaches store history on delete', () => {
    const preview = createPreviewDataset(now)
    expect(preview.stores).toHaveLength(7)
    expect(preview.items.some((item) => item.id === 'monitor')).toBe(true)
    expect(preview.snapshots.some((snapshot) => snapshot.item_id === 'monitor')).toBe(false)
    expect(new Set(preview.snapshots.map((snapshot) => snapshot.id)).size).toBe(preview.snapshots.length)
    const verdicts = new Set(preview.deals.filter((deal) => deal.status === 'open').map((deal) => deal.verdict))
    expect(verdicts.has('must_buy')).toBe(true)
    expect(verdicts.has('skip')).toBe(true)
    const removedStore = withoutStore(preview, 'bestbuy')
    expect(removedStore.stores.some((store) => store.id === 'bestbuy')).toBe(false)
    expect(removedStore.snapshots.some((snapshot) => snapshot.store_id === 'bestbuy')).toBe(false)
    expect(removedStore.snapshots.some((snapshot) => snapshot.store_id == null)).toBe(true)
    const removedItem = withoutItem(preview, 'tv')
    expect(removedItem.snapshots.some((snapshot) => snapshot.item_id === 'tv')).toBe(false)
    expect(removedItem.deals.some((deal) => deal.item_id === 'tv')).toBe(false)
  })
})

function blankish() {
  return {
    name: '',
    publicSummary: '',
    description: '',
    category: '',
    keywords: '',
    targetPrice: '',
    maxPrice: '',
    priority: 'normal' as const,
    condition: 'new',
    notes: '',
    imageUrl: '',
    specs: '',
    requirements: '',
    productUrl: '',
    enrichmentStatus: 'ready' as const,
    active: true,
  }
}
