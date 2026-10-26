import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { loadCountries } from '../data/countries'
import {
  countryByCode,
  countryFromSearchParams,
  defaultCountryCode,
  filterDatasetByCountry,
  formatMoney,
  mergeCountrySearchParams,
  readStoredCountryCode,
  taxPriceNote,
  writeStoredCountryCode,
  type CountryProfile,
  PRESET_COUNTRIES,
  matchesCountryCurrency,
} from '../domain/country'
import { useCatalog, type CatalogValue } from './catalog'

export interface CountryValue {
  code: string
  profile: CountryProfile
  countries: CountryProfile[]
  enabled: boolean
  setCountry: (code: string) => void
  catalog: CatalogValue
  formatPrice: (value: number | null | undefined) => string
  taxNote: string
  isLocalCurrency: (currency: string | null | undefined) => boolean
  openWaitlist: () => void
  waitlistOpen: boolean
  closeWaitlist: () => void
}

const CountryContext = createContext<CountryValue | null>(null)

export function useCountry(): CountryValue {
  const value = useContext(CountryContext)
  if (!value) throw new Error('useCountry must be used inside CountryProvider.')
  return value
}

export function CountryProvider({ children }: { children: ReactNode }) {
  const rawCatalog = useCatalog()
  const [searchParams, setSearchParams] = useSearchParams()
  const [countries, setCountries] = useState<CountryProfile[]>(PRESET_COUNTRIES)
  const [waitlistOpen, setWaitlistOpen] = useState(false)

  useEffect(() => {
    if (rawCatalog.source === 'preview') {
      setCountries(PRESET_COUNTRIES)
      return
    }
    void loadCountries().then(setCountries)
  }, [rawCatalog.source])

  const enabledCountries = useMemo(() => countries.filter((entry) => entry.enabled), [countries])

  const initialCode = useMemo(() => {
    const fromUrl = countryFromSearchParams(searchParams)
    const fromList = fromUrl ? countryByCode(countries, fromUrl) : null
    if (fromList) return fromList.code
    const stored = readStoredCountryCode()
    const fromStored = stored ? countryByCode(countries, stored) : null
    if (fromStored?.enabled) return fromStored.code
    return defaultCountryCode(enabledCountries.length > 0 ? enabledCountries : countries)
  }, [countries, enabledCountries, searchParams])

  const [code, setCodeState] = useState(initialCode)

  useEffect(() => {
    setCodeState(initialCode)
  }, [initialCode])

  const profile = countryByCode(countries, code) ?? PRESET_COUNTRIES[0]!

  const setCountry = useCallback((nextCode: string) => {
    const entry = countryByCode(countries, nextCode)
    if (!entry) return
    setCodeState(entry.code)
    writeStoredCountryCode(entry.code)
    setSearchParams(mergeCountrySearchParams(searchParams, entry.code), { replace: true })
  }, [countries, searchParams, setSearchParams])

  const catalog = useMemo<CatalogValue>(() => {
    const filtered = profile.enabled
      ? filterDatasetByCountry(rawCatalog, profile.code)
      : { ...rawCatalog, stores: [], snapshots: [], deals: [] }
    return { ...rawCatalog, ...filtered }
  }, [rawCatalog, profile])

  const value = useMemo<CountryValue>(() => ({
    code: profile.code,
    profile,
    countries,
    enabled: profile.enabled,
    setCountry,
    catalog,
    formatPrice: (amount) => formatMoney(amount, profile),
    taxNote: taxPriceNote(profile),
    isLocalCurrency: (currency) => matchesCountryCurrency(currency, profile),
    openWaitlist: () => setWaitlistOpen(true),
    waitlistOpen,
    closeWaitlist: () => setWaitlistOpen(false),
  }), [catalog, countries, profile, setCountry, waitlistOpen])

  return (
    <CountryContext.Provider value={value}>
      {children}
    </CountryContext.Provider>
  )
}
