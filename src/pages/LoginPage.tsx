import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import {
  explainAuthFailure,
  readWaitUntil,
  remainingCooldown,
  rememberWaitUntil,
  waitUntilAfterSend,
} from '../auth/callback'
import type { AuthFailure } from '../auth/callback'
import { isOwnerSession } from '../auth/owner'
import { consumeReturnPath } from '../auth/returnPath'
import { ThemeToggle } from '../components/ThemeToggle'
import { Button, controlClass } from '../components/ui'
import { magicLinkRedirect } from '../lib/config'
import { supabase } from '../lib/supabase'
import { useDocumentTitle } from '../lib/title'

export function LoginPage() {
  useDocumentTitle('Owner sign-in')
  const { notice, session } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [useCode, setUseCode] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hideNotice, setHideNotice] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [waitUntil, setWaitUntil] = useState<number | null>(() => readWaitUntil(sessionStorage))
  const remaining = remainingCooldown(waitUntil, now)
  const cooling = remaining > 0
  const shown = error ?? (hideNotice ? null : notice)

  useEffect(() => {
    if (!session || !isOwnerSession(session.user.id)) return
    const next = consumeReturnPath()
    navigate(next ?? '/', { replace: true })
  }, [navigate, session])

  useEffect(() => {
    if (!cooling) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [cooling])

  async function signInWithPassword(event: FormEvent) {
    event.preventDefault()
    const trimmed = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) || password.length === 0) {
      setError('Enter the owner email and password.')
      return
    }
    setPending(true)
    setError(null)
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: trimmed,
      password,
    })
    setPending(false)
    if (signInError) setError(explainAuthFailure(toFailure(signInError)))
  }

  async function sendCode(address: string) {
    const trimmed = address.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Enter the email address for the Harbour account.')
      return
    }
    if (remainingCooldown(waitUntil, Date.now()) > 0) return
    setPending(true)
    setError(null)
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: {
        emailRedirectTo: magicLinkRedirect(),
        shouldCreateUser: false,
      },
    })
    setPending(false)
    if (signInError) {
      const failure = toFailure(signInError)
      const until = waitUntilAfterSend(failure, Date.now())
      rememberWaitUntil(sessionStorage, until)
      setWaitUntil(until)
      setNow(Date.now())
      setError(explainAuthFailure(failure))
      return
    }
    const until = waitUntilAfterSend(null, Date.now())
    rememberWaitUntil(sessionStorage, until)
    setWaitUntil(until)
    setNow(Date.now())
    setHideNotice(true)
    setSentTo(trimmed)
    setEmail(trimmed)
  }

  async function verifyCode(event: FormEvent) {
    event.preventDefault()
    if (!sentTo) return
    const token = code.replace(/\s/g, '')
    if (!/^\d{6}$/.test(token)) {
      setError('Enter the 6-digit code from the email.')
      return
    }
    setPending(true)
    setError(null)
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: sentTo,
      token,
      type: 'email',
    })
    setPending(false)
    if (verifyError) setError(explainAuthFailure(toFailure(verifyError)))
  }

  const waitLabel = remaining > 0 ? `Wait ${Math.ceil(remaining / 1000)}s` : null

  return (
    <main className="grid min-h-screen place-items-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-between gap-3">
          <p className="font-display text-3xl">Harbour</p>
          <ThemeToggle />
        </div>
        <h1 className="mt-6 font-display text-4xl">Owner sign-in</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          Prices stay public. Sign in to edit the watchlist, stores, and deals.
        </p>
        {shown ? <p className="mt-4 rounded-2xl border border-clay/30 bg-clay-soft px-4 py-3 text-sm leading-6 text-clay">{shown}</p> : null}
        {useCode ? (
          sentTo ? (
            <form className="mt-8 grid gap-4" onSubmit={(event) => void verifyCode(event)}>
              <div className="rounded-3xl border border-pine/20 bg-pine-soft p-5">
                <p className="font-medium">Check {sentTo}</p>
                <p className="mt-2 text-sm leading-6 text-muted">
                  Type the 6-digit code. A link in the same email works in this browser.
                </p>
              </div>
              <label className="block">
                <span className="text-sm font-medium">Email code</span>
                <input
                  className={`${controlClass} mt-1 tracking-[0.3em]`}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  aria-label="Email code"
                  required
                />
              </label>
              <Button type="submit" disabled={pending}>{pending ? 'Checking…' : 'Sign in with code'}</Button>
              <div className="flex items-center justify-between gap-3 text-sm">
                <button type="button" className="text-pine underline" onClick={() => { setUseCode(false); setSentTo(null); setCode(''); setError(null) }}>
                  Use password instead
                </button>
                <button
                  type="button"
                  className="text-pine underline disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={pending || remaining > 0}
                  onClick={() => void sendCode(sentTo)}
                >
                  {waitLabel ?? 'Send again'}
                </button>
              </div>
            </form>
          ) : (
            <form className="mt-8 grid gap-4" onSubmit={(event) => { event.preventDefault(); void sendCode(email) }}>
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
              <Button type="submit" disabled={pending || remaining > 0}>
                {pending ? 'Sending…' : waitLabel ?? 'Email me a code'}
              </Button>
              {remaining > 0 ? (
                <p className="text-sm leading-6 text-muted">Another email can be sent when the timer finishes. The free mailer allows about two an hour.</p>
              ) : (
                <p className="text-sm leading-6 text-muted">The password is faster. The free mailer allows about two emails an hour.</p>
              )}
              <button type="button" className="justify-self-start text-sm text-pine underline" onClick={() => { setUseCode(false); setError(null) }}>
                Use password instead
              </button>
            </form>
          )
        ) : (
          <form className="mt-8 grid gap-4" onSubmit={(event) => void signInWithPassword(event)}>
            <label className="block">
              <span className="text-sm font-medium">Email</span>
              <input
                className={`${controlClass} mt-1`}
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Password</span>
              <input
                className={`${controlClass} mt-1`}
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>
            <Button type="submit" disabled={pending}>{pending ? 'Signing in…' : 'Sign in'}</Button>
            <button type="button" className="justify-self-start text-sm text-pine underline" onClick={() => { setUseCode(true); setError(null) }}>
              Email me a code instead
            </button>
          </form>
        )}
        <Link className="mt-8 inline-block text-sm text-muted underline" to="/">Back to prices</Link>
        {import.meta.env.DEV ? (
          <a className="mt-4 block text-sm text-pine underline" href={`${import.meta.env.BASE_URL}?preview=1`}>
            Browse with sample data
          </a>
        ) : null}
      </div>
    </main>
  )
}

function toFailure(error: { message: string; status?: number; code?: string; name?: string }): AuthFailure {
  return {
    message: error.message,
    status: error.status,
    code: error.code,
    name: error.name,
  }
}
