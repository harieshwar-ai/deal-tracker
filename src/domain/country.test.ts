import { describe, expect, it } from 'vitest'
import {
  DEFAULT_COUNTRY_CODE,
  PRESET_COUNTRIES,
  countryByCode,
  defaultCountryCode,
  countryHasPrices,
  filterDatasetByCountry,
  formatMoney,
  matchesCountryCurrency,
  mergeCountrySearchParams,
  normalizeCountryCode,
  readStoredCountryCode,
  storeCountryCode,
  taxPriceNote,
  writeStoredCountryCode,
} from './country'
import type { Dataset, Store } from './types'

const store = (overrides: Partial<Store> = {}): Store => ({
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Costco',
  base_url: null,
  country: 'CA',
  country_code: null,
  membership: null,
  notes: null,
  enabled: true,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  ...overrides,
})

describe('country helpers', () => {
  it('formats money and tax copy per country', () => {
    const ca = countryByCode(PRESET_COUNTRIES, 'CA')!
    const us = countryByCode(PRESET_COUNTRIES, 'US')!
    const gb = countryByCode(PRESET_COUNTRIES, 'GB')!
    expect(formatMoney(1299.99, ca)).toContain('1')
    expect(formatMoney(1299.99, ca)).toMatch(/\$|CA\$|CAD/)
    expect(taxPriceNote(ca)).toBe('with 13% HST')
    expect(taxPriceNote(us)).toBe('plus sales tax')
    expect(taxPriceNote(gb)).toBe('incl. VAT')
    expect(matchesCountryCurrency('CAD', ca)).toBe(true)
    expect(matchesCountryCurrency('USD', ca)).toBe(false)
  })

  it('persists country selection in localStorage', () => {
    const storage = new Map<string, string>()
    const original = globalThis.localStorage
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
      },
    })
    writeStoredCountryCode('GB')
    expect(readStoredCountryCode()).toBe('GB')
    writeStoredCountryCode('bad')
    expect(readStoredCountryCode()).toBeNull()
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: original })
  })

  it('merges country into search params', () => {
    const params = mergeCountrySearchParams(new URLSearchParams('q=1'), 'DE')
    expect(params.get('country')).toBe('DE')
    expect(params.get('q')).toBe('1')
  })

  it('detects when a country has no saved prices yet', () => {
    const usStore = store({ id: '22222222-2222-4222-8222-222222222222', country_code: 'US', country: 'US' })
    const data: Dataset = {
      items: [],
      stores: [store(), usStore],
      snapshots: [],
      deals: [],
    }
    expect(countryHasPrices(data, 'CA')).toBe(false)
    expect(countryHasPrices(data, 'US')).toBe(false)
  })

  it('filters dataset stores and dependent rows', () => {
    const usStore = store({ id: '22222222-2222-4222-8222-222222222222', country_code: 'US', country: 'US' })
    const data: Dataset = {
      items: [],
      stores: [store(), usStore],
      snapshots: [
        {
          id: 1,
          item_id: '33333333-3333-4333-8333-333333333333',
          store_id: store().id,
          product_title: null,
          product_url: null,
          price: 10,
          regular_price: null,
          currency: 'CAD',
          in_stock: true,
          member_only: null,
          captured_at: '2026-10-01T00:00:00.000Z',
          sale_ends_at: null,
          shipping: null,
          product_name: null,
          meets_requirements: true,
        },
        {
          id: 2,
          item_id: '33333333-3333-4333-8333-333333333333',
          store_id: usStore.id,
          product_title: null,
          product_url: null,
          price: 8,
          regular_price: null,
          currency: 'USD',
          in_stock: true,
          member_only: null,
          captured_at: '2026-10-01T00:00:00.000Z',
          sale_ends_at: null,
          shipping: null,
          product_name: null,
          meets_requirements: true,
        },
      ],
      deals: [],
    }
    const caOnly = filterDatasetByCountry(data, 'CA')
    expect(caOnly.stores).toHaveLength(1)
    expect(caOnly.snapshots).toHaveLength(1)
    expect(caOnly.snapshots[0]?.currency).toBe('CAD')
  })

  it('defaults to Canada among enabled harbour countries', () => {
    const canadaOnly = PRESET_COUNTRIES.map((entry) => ({ ...entry, enabled: entry.code === 'CA' }))
    expect(defaultCountryCode(canadaOnly)).toBe(DEFAULT_COUNTRY_CODE)
    expect(normalizeCountryCode(' ca ')).toBe('CA')
    expect(storeCountryCode(store({ country_code: null, country: 'ca' }))).toBe('CA')
  })
})
