import { useMemo } from 'react'
import { countryByCode } from '../domain/country'
import { useCountry } from '../state/country'
import { cn } from '../lib/cn'
import { Select } from './ui/select'

export function CountryPicker() {
  const { countries, profile, setCountry, openWaitlist } = useCountry()
  const sorted = useMemo(
    () => [...countries].sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name)),
    [countries],
  )

  function pick(next: string) {
    const entry = countryByCode(countries, next)
    if (!entry?.enabled) return
    setCountry(entry.code)
  }

  return (
    <div className="flex items-center gap-2">
      <label className="sr-only" htmlFor="country-picker">Country</label>
      <Select
        label="Country"
        value={profile.code}
        onValueChange={pick}
        className="min-w-[10.5rem]"
        options={sorted.map((entry) => ({
          value: entry.code,
          label: entry.name,
        }))}
      />
      <button type="button" className="hidden text-xs text-muted underline sm:inline" onClick={openWaitlist}>
        Don&apos;t see your country?
      </button>
    </div>
  )
}

export function CountryPickerCompact({ className }: { className?: string }) {
  const { profile, formatPrice } = useCountry()
  return (
    <p className={cn('text-sm text-foam/60', className)}>
      {profile.name} · {formatPrice(0).replace(/[\d.,\s]/g, '').trim() || profile.currency}
    </p>
  )
}
