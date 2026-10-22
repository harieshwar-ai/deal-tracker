import { useState } from 'react'
import type { FormEvent } from 'react'
import { rememberReturnPath } from '../auth/returnPath'
import { magicLinkRedirect } from '../lib/config'
import { supabase } from '../lib/supabase'
import { useDocumentTitle } from '../lib/title'
import { Button, controlClass } from '../components/ui'

const stores = ['Costco', 'Amazon', 'Walmart', 'Canada Computers', 'Best Buy', 'Staples', 'Visions']

export function LoginPage() {
  useDocumentTitle('Sign in')
  const [email, setEmail] = useState('')
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(() => {
    const description = new URLSearchParams(window.location.search).get('error_description')
    return description ? description.replaceAll('+', ' ') : null
  })

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmed = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Enter the email address for your Harbour account.')
      return
    }
    setPending(true)
    setError(null)
    rememberReturnPath()
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { emailRedirectTo: magicLinkRedirect() },
    })
    setPending(false)
    if (signInError) {
      setError(signInError.message)
      return
    }
    setSentTo(trimmed)
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-[minmax(0,1.1fr)_minmax(22rem,0.9fr)]">
      <section className="flex flex-col justify-between bg-bark px-6 py-10 text-paper-2 sm:px-10 lg:px-14">
        <p className="font-display text-3xl">Harbour</p>
        <div className="max-w-xl py-12">
          <h1 className="font-display text-5xl leading-[1.05] sm:text-6xl">Know the price before you leave the house.</h1>
          <p className="mt-5 max-w-md text-lg leading-7 text-paper-2/80">
            One watchlist for Hamilton. The daily check writes Canadian prices here, and you decide what is worth buying.
          </p>
          <ul className="mt-8 flex flex-wrap gap-2">
            {stores.map((store) => (
              <li key={store} className="rounded-full border border-white/15 px-3 py-1 text-sm text-paper-2/80">
                {store}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-paper-2/60">Hamilton, Ontario · Prices in CAD</p>
      </section>
      <section className="flex items-center px-6 py-12 sm:px-10">
        <div className="mx-auto w-full max-w-md">
          <h2 className="font-display text-4xl">Sign in</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            A magic link is sent to your email. Open it in this browser — the sign-in stays on this device.
          </p>
          {sentTo ? (
            <div className="mt-8 rounded-3xl border border-pine/20 bg-pine-soft p-5">
              <p className="font-medium">Check {sentTo}</p>
              <p className="mt-2 text-sm leading-6 text-muted">
                The link expires quickly. If it asks you to sign up, the account has not been created yet, or public sign-ups are still on.
              </p>
              <button type="button" className="mt-4 text-sm text-pine underline" onClick={() => setSentTo(null)}>
                Use a different email
              </button>
            </div>
          ) : (
            <form className="mt-8 grid gap-4" onSubmit={(event) => void handleSubmit(event)}>
              <label className="block">
                <span className="text-sm font-medium">Email</span>
                <input
                  className={`${controlClass} mt-1`}
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </label>
              {error ? <p className="text-sm text-clay">{error}</p> : null}
              <Button type="submit" disabled={pending}>
                {pending ? 'Sending…' : 'Email me a link'}
              </Button>
            </form>
          )}
          {import.meta.env.DEV ? (
            <a className="mt-8 inline-block text-sm text-pine underline" href="?preview=1">
              Browse with sample data
            </a>
          ) : null}
        </div>
      </section>
    </main>
  )
}
