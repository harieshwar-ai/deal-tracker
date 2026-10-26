import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { joinCountryWaitlist } from '../data/waitlist'
import { alertsFunctionUrl } from '../lib/config'
import { supabasePublishableKey } from '../lib/config'
import { isoCountryOptions, normalizeCountryCode } from '../domain/country'
import { normalizeEmail } from '../domain/alerts'
import { useCountry } from '../state/country'
import { useToast } from './toast'
import { Button } from './ui/button'
import { Modal } from './ui/dialog'
import { Field, Input, controlClass } from './ui/input'
import { Select } from './ui/select'

export function CountryWaitlistDialog() {
  const { waitlistOpen, closeWaitlist, countries } = useCountry()
  const push = useToast()
  const [email, setEmail] = useState('')
  const [countryCode, setCountryCode] = useState('US')
  const [consent, setConsent] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isoOptions = useMemo(() => isoCountryOptions(), [])
  const harbourCodes = useMemo(() => new Set(countries.map((entry) => entry.code)), [countries])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    const normalizedEmail = normalizeEmail(email)
    if (!normalizedEmail) {
      setError('Enter a valid email address.')
      return
    }
    const code = normalizeCountryCode(countryCode)
    if (!code) {
      setError('Choose a country.')
      return
    }
    if (!consent) {
      setError('Check the box to confirm you want email updates.')
      return
    }
    const name = isoOptions.find((entry) => entry.code === code)?.name ?? code
    if (harbourCodes.has(code) && countries.find((entry) => entry.code === code)?.enabled) {
      setError('Harbour already supports this country in the picker.')
      return
    }
    setPending(true)
    const result = await joinCountryWaitlist({ email: normalizedEmail, countryCode: code, countryName: name })
    setPending(false)
    if (!result.ok) {
      if (result.error === 'rate_limited') setError('Too many requests. Try again in an hour.')
      else if (result.error === 'already_available') setError('This country is already available in Harbour.')
      else setError('Could not save your request. Try again later.')
      return
    }
    if (result.result === 'pending') {
      try {
        await fetch(alertsFunctionUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/json', apikey: supabasePublishableKey },
          body: JSON.stringify({ action: 'waitlist_confirm', waitlist_id: result.waitlistId, email: normalizedEmail }),
        })
      } catch {
        // row saved
      }
    }
    push('ok', result.result === 'already_confirmed' ? 'You are already on the waitlist for this country.' : 'Check your inbox to confirm')
    setEmail('')
    setConsent(false)
    closeWaitlist()
  }

  return (
    <Modal open={waitlistOpen} onClose={closeWaitlist} title="Request your country">
      <form className="grid gap-4" onSubmit={submit}>
        <p className="text-sm text-muted">Harbour will email you when stores in your country are added. You can remove yourself from any message.</p>
        <Field label="Email">
          <Input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </Field>
        <Field label="Country">
          <Select
            label="Country"
            value={countryCode}
            onValueChange={setCountryCode}
            options={isoOptions.map((entry) => ({ value: entry.code, label: entry.name }))}
          />
        </Field>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className={controlClass}
            checked={consent}
            onChange={(event) => setConsent(event.target.checked)}
          />
          <span>I agree to receive one email about Harbour launching in this country. I can unsubscribe from that message.</span>
        </label>
        {error ? <p className="text-sm text-clay" role="alert">{error}</p> : null}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={pending}>{pending ? 'Saving…' : 'Join waitlist'}</Button>
          <Button type="button" variant="ghost" onClick={closeWaitlist}>Cancel</Button>
        </div>
      </form>
    </Modal>
  )
}
