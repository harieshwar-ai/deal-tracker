import { useMemo, useState } from 'react'
import { countryByCode } from '../domain/country'
import { useCountry } from '../state/country'
import { cn } from '../lib/cn'
import { Button } from './ui/button'
import { Modal } from './ui/dialog'
import { Select } from './ui/select'

export function CountryPicker() {
  const { countries, code, profile, setCountry, enabled, openWaitlist } = useCountry()
  const [notifyOpen, setNotifyOpen] = useState(false)
  const sorted = useMemo(
    () => [...countries].sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name)),
    [countries],
  )

  function pick(next: string) {
    const entry = countryByCode(countries, next)
    if (!entry) return
    if (!entry.enabled) {
      setNotifyOpen(true)
      return
    }
    setCountry(entry.code)
  }

  const notifyCountry = countryByCode(countries, code)

  return (
    <>
      <div className="flex items-center gap-2">
        <label className="sr-only" htmlFor="country-picker">Country</label>
        <Select
          label="Country"
          value={profile.code}
          onValueChange={pick}
          className="min-w-[10.5rem]"
          options={sorted.map((entry) => ({
            value: entry.code,
            label: entry.enabled ? entry.name : `${entry.name} · Coming soon`,
          }))}
        />
        {!enabled ? (
          <span className="text-xs text-muted">Coming soon</span>
        ) : null}
        <button type="button" className="hidden text-xs text-muted underline sm:inline" onClick={openWaitlist}>
          Don&apos;t see your country?
        </button>
      </div>
      <Modal open={notifyOpen} onClose={() => setNotifyOpen(false)} title={`${notifyCountry?.name ?? 'This country'} is coming soon`}>
        <p className="text-sm text-muted">
          Harbour is not tracking stores in {notifyCountry?.name ?? 'this country'} yet. Join the waitlist and we will email you when it launches.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" onClick={() => { setNotifyOpen(false); openWaitlist() }}>Notify me</Button>
          <Button type="button" variant="ghost" onClick={() => setNotifyOpen(false)}>Not now</Button>
        </div>
      </Modal>
    </>
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
