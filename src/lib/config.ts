const defaultUrl = 'https://ieohjxtkoiphewcfttuw.supabase.co'
const defaultKey = 'sb_publishable_cCOwmMlsyhGR1lEf-S8rMg_DRBN6ny6'

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || defaultUrl
export const supabasePublishableKey = import.meta.env.VITE_SUPABASE_ANON_KEY || defaultKey

export const routerBasename = import.meta.env.BASE_URL.replace(/\/$/, '')

export function magicLinkRedirect(): string {
  return new URL(import.meta.env.BASE_URL, window.location.origin).toString()
}
