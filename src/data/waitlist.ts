import { normalizeCountryCode } from '../domain/country'
import { supabase } from '../lib/supabase'

export type WaitlistError = 'invalid_email' | 'invalid_country' | 'already_available' | 'rate_limited' | 'unavailable'

export interface WaitlistJoinResult {
  ok: true
  result: 'pending' | 'already_confirmed'
  waitlistId: string
}

export async function joinCountryWaitlist(input: {
  email: string
  countryCode: string
  countryName: string
}): Promise<WaitlistJoinResult | { ok: false; error: WaitlistError }> {
  const code = normalizeCountryCode(input.countryCode)
  if (!code) return { ok: false, error: 'invalid_country' }
  const { data, error } = await supabase.rpc('join_country_waitlist', {
    p_email: input.email,
    p_country_code: code,
    p_country_name: input.countryName,
  })
  if (error) return { ok: false, error: 'unavailable' }
  if (!data || typeof data !== 'object') return { ok: false, error: 'unavailable' }
  const row = data as { ok?: unknown; error?: unknown; result?: unknown; waitlist_id?: unknown }
  if (row.ok === false) {
    const err = typeof row.error === 'string' ? row.error : 'unavailable'
    if (err === 'invalid_email' || err === 'invalid_country' || err === 'already_available' || err === 'rate_limited') {
      return { ok: false, error: err }
    }
    return { ok: false, error: 'unavailable' }
  }
  if (typeof row.waitlist_id !== 'string') return { ok: false, error: 'unavailable' }
  const result = row.result === 'already_confirmed' ? 'already_confirmed' : 'pending'
  return { ok: true, result, waitlistId: row.waitlist_id }
}

export async function confirmCountryWaitlist(token: string) {
  const { data, error } = await supabase.rpc('confirm_country_waitlist', { p_token: token })
  if (error) return { ok: false as const, error: 'unavailable' as const }
  const row = data as { ok?: unknown; error?: unknown; result?: unknown; country_name?: unknown }
  if (row.ok === false) {
    if (row.error === 'invalid_token') return { ok: false as const, error: 'invalid_token' as const }
    return { ok: false as const, error: 'unavailable' as const }
  }
  if (row.result === 'confirmed') return { ok: true as const, result: 'confirmed' as const, countryName: String(row.country_name ?? '') }
  if (row.result === 'already_confirmed') return { ok: true as const, result: 'already_confirmed' as const, countryName: String(row.country_name ?? '') }
  return { ok: false as const, error: 'unavailable' as const }
}

export async function unsubscribeCountryWaitlist(token: string) {
  const { data, error } = await supabase.rpc('unsubscribe_country_waitlist', { p_token: token })
  if (error) return { ok: false as const, error: 'unavailable' as const }
  const row = data as { ok?: unknown; error?: unknown }
  if (row.ok === false && row.error === 'invalid_token') return { ok: false as const, error: 'invalid_token' as const }
  if (row.ok === true) return { ok: true as const }
  return { ok: false as const, error: 'unavailable' as const }
}

export interface WaitlistCountryCount {
  countryCode: string
  countryName: string
  pending: number
  confirmed: number
  emails: string[]
}

export async function loadWaitlistCounts(): Promise<{ ok: true; rows: WaitlistCountryCount[] } | { ok: false }> {
  const { data, error } = await supabase.rpc('list_country_waitlist_counts')
  if (error || !Array.isArray(data)) return { ok: false }
  const rows: WaitlistCountryCount[] = []
  for (const entry of data) {
    if (!entry || typeof entry !== 'object') continue
    const row = entry as Record<string, unknown>
    if (typeof row.country_code !== 'string' || typeof row.country_name !== 'string') continue
    rows.push({
      countryCode: row.country_code,
      countryName: row.country_name,
      pending: typeof row.pending === 'number' ? row.pending : 0,
      confirmed: typeof row.confirmed === 'number' ? row.confirmed : 0,
      emails: Array.isArray(row.emails) ? row.emails.filter((email): email is string => typeof email === 'string') : [],
    })
  }
  return { ok: true, rows }
}
