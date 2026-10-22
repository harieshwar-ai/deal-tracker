import { createClient } from '@supabase/supabase-js'
import { supabasePublishableKey, supabaseUrl } from './config'

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    flowType: 'pkce',
    detectSessionInUrl: true,
    persistSession: true,
    autoRefreshToken: true,
  },
})
