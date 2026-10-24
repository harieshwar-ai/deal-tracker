import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { explainAuthFailure } from '../auth/callback'
import type { AuthFailure } from '../auth/callback'
import { isOwnerSession } from '../auth/owner'
import { consumeReturnPath } from '../auth/returnPath'
import { ThemeToggle } from '../components/ThemeToggle'
import { Button } from '../components/ui/button'
import { controlClass } from '../components/ui/input'
import { supabase } from '../lib/supabase'
import { useDocumentTitle } from '../lib/title'

export function LoginPage() {
  useDocumentTitle('Owner sign-in')
  const { notice, session } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hideNotice, setHideNotice] = useState(false)
  const shown = error ?? (hideNotice ? null : notice)

  useEffect(() => {
    if (!session || !isOwnerSession(session.user.id)) return
    const next = consumeReturnPath()
    navigate(next ?? '/', { replace: true })
  }, [navigate, session])

  async function signInWithPassword(event: FormEvent) {
    event.preventDefault()
    const trimmed = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) || password.length === 0) {
      setError('Enter the owner email and password.')
      return
    }
    setPending(true)
    setError(null)
    setHideNotice(true)
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: trimmed,
      password,
    })
    setPending(false)
    if (signInError) setError(explainAuthFailure(toFailure(signInError)))
  }

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
        </form>
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
