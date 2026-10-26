import type { Dataset, Store } from './types'

export interface CountryProfile {
  code: string
  name: string
  currency: string
  locale: string
  taxLabel: string
  taxRate: number | null
  pricesIncludeTax: boolean
  enabled: boolean
  sortOrder: number
}

export const COUNTRY_STORAGE_KEY = 'harbour.country'
export const DEFAULT_COUNTRY_CODE = 'CA'

/** Fallback when countries table is not loaded yet (preview / offline). */
export const PRESET_COUNTRIES: CountryProfile[] = [
  { code: 'CA', name: 'Canada', currency: 'CAD', locale: 'en-CA', taxLabel: 'HST', taxRate: 0.13, pricesIncludeTax: false, enabled: true, sortOrder: 10 },
  { code: 'US', name: 'United States', currency: 'USD', locale: 'en-US', taxLabel: 'sales tax', taxRate: null, pricesIncludeTax: false, enabled: false, sortOrder: 20 },
  { code: 'GB', name: 'United Kingdom', currency: 'GBP', locale: 'en-GB', taxLabel: 'VAT', taxRate: 0.2, pricesIncludeTax: true, enabled: false, sortOrder: 30 },
  { code: 'IN', name: 'India', currency: 'INR', locale: 'en-IN', taxLabel: 'GST', taxRate: 0.18, pricesIncludeTax: true, enabled: false, sortOrder: 40 },
  { code: 'AU', name: 'Australia', currency: 'AUD', locale: 'en-AU', taxLabel: 'GST', taxRate: 0.1, pricesIncludeTax: true, enabled: false, sortOrder: 50 },
  { code: 'DE', name: 'Germany', currency: 'EUR', locale: 'de-DE', taxLabel: 'MwSt', taxRate: 0.19, pricesIncludeTax: true, enabled: false, sortOrder: 60 },
]

const TIMEZONE_COUNTRY: Record<string, string> = {
  'America/Toronto': 'CA',
  'America/Vancouver': 'CA',
  'America/Edmonton': 'CA',
  'America/Winnipeg': 'CA',
  'America/Halifax': 'CA',
  'America/New_York': 'US',
  'America/Chicago': 'US',
  'America/Denver': 'US',
  'America/Los_Angeles': 'US',
  'Europe/London': 'GB',
  'Asia/Kolkata': 'IN',
  'Australia/Sydney': 'AU',
  'Australia/Melbourne': 'AU',
  'Europe/Berlin': 'DE',
}

export function normalizeCountryCode(raw: string | null | undefined): string | null {
  const code = (raw ?? '').trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(code)) return null
  return code
}

export function storeCountryCode(store: Store): string {
  const fromColumn = normalizeCountryCode(store.country_code)
  if (fromColumn) return fromColumn
  return normalizeCountryCode(store.country) ?? DEFAULT_COUNTRY_CODE
}

export function countryByCode(countries: readonly CountryProfile[], code: string): CountryProfile | null {
  const normalized = normalizeCountryCode(code)
  if (!normalized) return null
  return countries.find((entry) => entry.code === normalized) ?? null
}

export function defaultCountryCode(countries: readonly CountryProfile[]): string {
  const enabled = countries.filter((entry) => entry.enabled)
  const fromBrowser = guessCountryFromBrowser(enabled)
  if (fromBrowser) return fromBrowser
  return enabled.find((entry) => entry.code === DEFAULT_COUNTRY_CODE)?.code ?? enabled[0]?.code ?? DEFAULT_COUNTRY_CODE
}

export function guessCountryFromBrowser(enabled: readonly CountryProfile[]): string | null {
  const enabledCodes = new Set(enabled.map((entry) => entry.code))
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    const fromTz = tz ? TIMEZONE_COUNTRY[tz] : null
    if (fromTz && enabledCodes.has(fromTz)) return fromTz
  } catch {
    // ignore
  }
  const lang = typeof navigator !== 'undefined' ? navigator.language : ''
  const match = lang.match(/-([A-Za-z]{2})$/)
  const fromLang = match ? normalizeCountryCode(match[1]) : null
  if (fromLang && enabledCodes.has(fromLang)) return fromLang
  if (enabledCodes.has(DEFAULT_COUNTRY_CODE)) return DEFAULT_COUNTRY_CODE
  return enabled[0]?.code ?? null
}

export function readStoredCountryCode(): string | null {
  if (typeof localStorage === 'undefined') return null
  try {
    return normalizeCountryCode(localStorage.getItem(COUNTRY_STORAGE_KEY))
  } catch {
    return null
  }
}

export function writeStoredCountryCode(code: string): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(COUNTRY_STORAGE_KEY, code)
  } catch {
    // ignore quota errors
  }
}

export function countryFromSearchParams(params: URLSearchParams): string | null {
  return normalizeCountryCode(params.get('country'))
}

export function mergeCountrySearchParams(params: URLSearchParams, code: string): URLSearchParams {
  const next = new URLSearchParams(params)
  next.set('country', code)
  return next
}

export function formatMoney(
  value: number | null | undefined,
  profile: Pick<CountryProfile, 'currency' | 'locale'>,
): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return new Intl.NumberFormat(profile.locale, {
    style: 'currency',
    currency: profile.currency,
  }).format(value)
}

export function taxPriceNote(profile: CountryProfile): string {
  if (profile.code === 'CA' && profile.taxRate != null) {
    const pct = Math.round(profile.taxRate * 100)
    return `with ${pct}% ${profile.taxLabel}`
  }
  if (profile.code === 'US') return 'plus sales tax'
  if (profile.pricesIncludeTax) {
    if (profile.code === 'GB' || profile.code === 'DE') return `incl. ${profile.taxLabel}`
    if (profile.code === 'AU' || profile.code === 'IN') return 'incl. GST'
    return `incl. ${profile.taxLabel}`
  }
  if (profile.taxRate != null) {
    const pct = Math.round(profile.taxRate * 100)
    return `plus ${pct}% ${profile.taxLabel}`
  }
  return ''
}

export function matchesCountryCurrency(currency: string | null | undefined, profile: CountryProfile): boolean {
  return (currency ?? '').toUpperCase() === profile.currency.toUpperCase()
}

export function storesInCountry(stores: readonly Store[], code: string): Store[] {
  const normalized = normalizeCountryCode(code) ?? DEFAULT_COUNTRY_CODE
  return stores.filter((store) => storeCountryCode(store) === normalized)
}

export function storeIdsInCountry(stores: readonly Store[], code: string): Set<string> {
  return new Set(storesInCountry(stores, code).map((store) => store.id))
}

export function filterDatasetByCountry(data: Dataset, code: string): Dataset {
  const storeIds = storeIdsInCountry(data.stores, code)
  return {
    items: data.items,
    stores: data.stores.filter((store) => storeIds.has(store.id)),
    snapshots: data.snapshots.filter((snapshot) => snapshot.store_id != null && storeIds.has(snapshot.store_id)),
    deals: data.deals.filter((deal) => deal.store_id != null && storeIds.has(deal.store_id)),
  }
}

export function otherTrackedCountries(
  data: Dataset,
  itemId: string,
  currentCode: string,
): { code: string; name: string }[] {
  const current = normalizeCountryCode(currentCode) ?? DEFAULT_COUNTRY_CODE
  const storeById = new Map(data.stores.map((store) => [store.id, store]))
  const codes = new Set<string>()
  for (const snapshot of data.snapshots) {
    if (snapshot.item_id !== itemId || !snapshot.store_id) continue
    const store = storeById.get(snapshot.store_id)
    if (!store) continue
    codes.add(storeCountryCode(store))
  }
  codes.delete(current)
  return [...codes]
    .map((code) => ({ code, name: PRESET_COUNTRIES.find((entry) => entry.code === code)?.name ?? code }))
    .sort((left, right) => left.name.localeCompare(right.name))
}

const ISO_FALLBACK_CODES = [
  'AD', 'AE', 'AF', 'AG', 'AI', 'AL', 'AM', 'AO', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AW', 'AX', 'AZ',
  'BA', 'BB', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI', 'BJ', 'BL', 'BM', 'BN', 'BO', 'BQ', 'BR', 'BS', 'BT', 'BV', 'BW', 'BY', 'BZ',
  'CA', 'CC', 'CD', 'CF', 'CG', 'CH', 'CI', 'CK', 'CL', 'CM', 'CN', 'CO', 'CR', 'CU', 'CV', 'CW', 'CX', 'CY', 'CZ',
  'DE', 'DJ', 'DK', 'DM', 'DO', 'DZ',
  'EC', 'EE', 'EG', 'EH', 'ER', 'ES', 'ET',
  'FI', 'FJ', 'FK', 'FM', 'FO', 'FR',
  'GA', 'GB', 'GD', 'GE', 'GF', 'GG', 'GH', 'GI', 'GL', 'GM', 'GN', 'GP', 'GQ', 'GR', 'GS', 'GT', 'GU', 'GW', 'GY',
  'HK', 'HM', 'HN', 'HR', 'HT', 'HU',
  'ID', 'IE', 'IL', 'IM', 'IN', 'IO', 'IQ', 'IR', 'IS', 'IT',
  'JE', 'JM', 'JO', 'JP',
  'KE', 'KG', 'KH', 'KI', 'KM', 'KN', 'KP', 'KR', 'KW', 'KY', 'KZ',
  'LA', 'LB', 'LC', 'LI', 'LK', 'LR', 'LS', 'LT', 'LU', 'LV', 'LY',
  'MA', 'MC', 'MD', 'ME', 'MF', 'MG', 'MH', 'MK', 'ML', 'MM', 'MN', 'MO', 'MP', 'MQ', 'MR', 'MS', 'MT', 'MU', 'MV', 'MW', 'MX', 'MY', 'MZ',
  'NA', 'NC', 'NE', 'NF', 'NG', 'NI', 'NL', 'NO', 'NP', 'NR', 'NU', 'NZ',
  'OM',
  'PA', 'PE', 'PF', 'PG', 'PH', 'PK', 'PL', 'PM', 'PN', 'PR', 'PS', 'PT', 'PW', 'PY',
  'QA',
  'RE', 'RO', 'RS', 'RU', 'RW',
  'SA', 'SB', 'SC', 'SD', 'SE', 'SG', 'SH', 'SI', 'SJ', 'SK', 'SL', 'SM', 'SN', 'SO', 'SR', 'SS', 'ST', 'SV', 'SX', 'SY', 'SZ',
  'TC', 'TD', 'TF', 'TG', 'TH', 'TJ', 'TK', 'TL', 'TM', 'TN', 'TO', 'TR', 'TT', 'TV', 'TW', 'TZ',
  'UA', 'UG', 'UM', 'US', 'UY', 'UZ',
  'VA', 'VC', 'VE', 'VG', 'VI', 'VN', 'VU',
  'WF', 'WS',
  'YE', 'YT',
  'ZA', 'ZM', 'ZW',
] as const

export function isoCountryOptions(): { code: string; name: string }[] {
  let regions: string[] = [...ISO_FALLBACK_CODES]
  try {
    const supported = (Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf
    const fromIntl = supported?.('region')
    if (fromIntl?.length) regions = fromIntl.filter((code) => /^[A-Z]{2}$/.test(code))
  } catch {
    // Chromium and some test runtimes do not support region keys yet.
  }
  const display = new Intl.DisplayNames(['en'], { type: 'region' })
  return regions
    .map((code) => ({ code, name: display.of(code) ?? code }))
    .sort((left, right) => left.name.localeCompare(right.name))
}

export function parseCountryRow(row: unknown): CountryProfile | null {
  if (!row || typeof row !== 'object') return null
  const record = row as Record<string, unknown>
  const code = normalizeCountryCode(typeof record.code === 'string' ? record.code : null)
  if (!code) return null
  const name = typeof record.name === 'string' ? record.name.trim() : ''
  const currency = typeof record.currency === 'string' ? record.currency.trim().toUpperCase() : ''
  const locale = typeof record.locale === 'string' ? record.locale.trim() : ''
  const taxLabel = typeof record.tax_label === 'string' ? record.tax_label.trim() : ''
  if (!name || currency.length !== 3 || !locale || !taxLabel) return null
  const taxRate = typeof record.tax_rate === 'number' && Number.isFinite(record.tax_rate) ? record.tax_rate : null
  return {
    code,
    name,
    currency,
    locale,
    taxLabel,
    taxRate,
    pricesIncludeTax: record.prices_include_tax === true,
    enabled: record.enabled === true,
    sortOrder: typeof record.sort_order === 'number' ? record.sort_order : 0,
  }
}
