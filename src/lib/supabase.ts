import { createClient } from '@supabase/supabase-js'
import { supabasePublishableKey, supabaseUrl } from './config'

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
})
