import { createClient } from '@supabase/supabase-js'
import { isSendableBearer } from '../data/parse'
import { supabasePublishableKey, supabaseUrl } from './config'

const fetchWithoutUnusableBearer: typeof fetch = (input, init) => {
  const headers = new Headers(init?.headers)
  const current = headers.get('Authorization')
  if (current) {
    const token = current.replace(/^Bearer\s+/i, '').trim()
    if (current !== token && !isSendableBearer(token)) headers.delete('Authorization')
  }
  return fetch(input, { ...init, headers })
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    flowType: 'pkce',
    // Automatic detection only exchanges ?code when this browser already has
    // the PKCE verifier. A magic link opened without that verifier was ignored
    // and never called /token. Harbour exchanges the code itself, once.
    detectSessionInUrl: false,
    persistSession: true,
    autoRefreshToken: true,
  },
  global: {
    // sb_publishable keys and placeholder signatures are not JWTs. Sending
    // them as Bearer makes PostgREST answer "No suitable key or wrong key type".
    fetch: fetchWithoutUnusableBearer,
  },
})
