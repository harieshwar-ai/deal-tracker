import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface AuthValue {
  ready: boolean
  session: Session | null
  email: string | null
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [session, setSession] = useState<Session | null>(null)

  useEffect(() => {
    let active = true
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!active) return
      setSession(next)
      setReady(true)
    })
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setReady(true)
    })
    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!session) return
    const url = new URL(window.location.href)
    if (!url.searchParams.has('code') && !url.searchParams.has('error')) return
    url.searchParams.delete('code')
    url.searchParams.delete('error')
    url.searchParams.delete('error_code')
    url.searchParams.delete('error_description')
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
  }, [session])

  const value = useMemo<AuthValue>(() => ({
    ready,
    session,
    email: session?.user.email ?? null,
    signOut: async () => {
      sessionStorage.removeItem('harbour-after-login')
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    },
  }), [ready, session])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider.')
  return value
}
