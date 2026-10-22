import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { previewOwnerRequested } from '../preview/mode'
import {
  captureAuthCallback,
  hasAuthCallback,
  replaceAuthCallbackUrl,
} from './callback'
import type { AuthFailure } from './callback'
import { exchangeCodeOnce } from './exchange'
import { isOwnerSession } from './owner'

interface AuthValue {
  ready: boolean
  session: Session | null
  email: string | null
  notice: string | null
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!active) return
      if (next && !isOwnerSession(next.user.id)) {
        setSession(null)
        setNotice('Only the Harbour owner can sign in.')
        window.setTimeout(() => {
          void supabase.auth.signOut()
        }, 0)
        return
      }
      setSession(next)
    })
    const callback = captureAuthCallback(window.location.search)
    void (async () => {
      let nextNotice = callback.message
      if (callback.code) {
        const outcome = await exchangeCodeOnce(callback.code, async (code) => {
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          return { error: error ? toFailure(error) : null }
        })
        nextNotice = outcome.errorMessage
      }
      if (hasAuthCallback(window.location.search)) replaceAuthCallbackUrl()
      const { data } = await supabase.auth.getSession()
      if (!active) return
      if (data.session && !isOwnerSession(data.session.user.id)) {
        await supabase.auth.signOut()
        if (!active) return
        setSession(null)
        setNotice('Only the Harbour owner can sign in.')
        setReady(true)
        return
      }
      setSession(data.session)
      setNotice(data.session ? null : nextNotice)
      setReady(true)
    })()
    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthValue>(() => ({
    ready,
    session,
    email: session?.user.email ?? null,
    notice,
    signOut: async () => {
      sessionStorage.removeItem('harbour-after-login')
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    },
  }), [notice, ready, session])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider.')
  return value
}

export function useCanEdit(): boolean {
  const { session } = useAuth()
  return isOwnerSession(session?.user.id) || previewOwnerRequested()
}

function toFailure(error: { message: string; status?: number; code?: string; name?: string }): AuthFailure {
  return {
    message: error.message,
    status: error.status,
    code: error.code,
    name: error.name,
  }
}
