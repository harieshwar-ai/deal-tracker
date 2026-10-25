import {
  parseSubscribeResult,
  parseTokenResult,
  type SubscribeError,
  type SubscriberListItem,
  type TokenOutcome,
} from '../domain/alerts'
import { supabasePublishableKey, alertsFunctionUrl } from '../lib/config'
import { supabase } from '../lib/supabase'

export interface AlertChoice {
  email: string
  itemId: string | null
  category: string | null
}

export async function subscribeToAlerts(choice: AlertChoice) {
  const { data, error } = await supabase.rpc('subscribe_to_alerts', {
    p_email: choice.email,
    p_item_id: choice.itemId,
    p_category: choice.category,
  })
  if (error) return { ok: false as const, error: 'unavailable' as const }
  return parseSubscribeResult(data)
}

export async function requestConfirmationEmail(subscriptionId: string, email: string): Promise<void> {
  try {
    await fetch(alertsFunctionUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        apikey: supabasePublishableKey,
      },
      body: JSON.stringify({ action: 'confirm', subscription_id: subscriptionId, email }),
    })
  } catch {
    // The row is saved. The message is sent when the function is configured.
  }
}

export async function confirmAlert(token: string): Promise<TokenOutcome> {
  const { data, error } = await supabase.rpc('confirm_alert', { p_token: token })
  if (error) return { ok: false, error: 'unavailable' }
  return parseTokenResult(data, 'confirm')
}

export async function unsubscribeAlert(token: string): Promise<TokenOutcome> {
  const { data, error } = await supabase.rpc('unsubscribe_alert', { p_token: token })
  if (error) return { ok: false, error: 'unavailable' }
  return parseTokenResult(data, 'unsubscribe')
}

export async function loadSubscribers(): Promise<{ ok: true; rows: SubscriberListItem[] } | { ok: false }> {
  // Owner list goes through a definer function so the session never selects
  // confirm_token or unsubscribe_token. A table select under a session the
  // API cannot verify is what surfaced "No suitable key or wrong key type".
  const { data, error } = await supabase.rpc('list_alert_subscribers')
  if (error || !Array.isArray(data)) return { ok: false }
  const rows: SubscriberListItem[] = []
  for (const row of data) {
    if (!row || typeof row !== 'object') continue
    const entry = row as { id?: unknown; email?: unknown; item_id?: unknown; category?: unknown; status?: unknown }
    if (typeof entry.id !== 'string' || typeof entry.email !== 'string') continue
    if (entry.status !== 'pending' && entry.status !== 'confirmed' && entry.status !== 'unsubscribed') continue
    rows.push({
      id: entry.id,
      email: entry.email,
      itemId: typeof entry.item_id === 'string' ? entry.item_id : null,
      category: typeof entry.category === 'string' ? entry.category : null,
      status: entry.status,
    })
  }
  return { ok: true, rows }
}

export function subscribeErrorCopy(error: SubscribeError | 'unavailable'): string {
  if (error === 'invalid_email') return 'Enter a valid email address.'
  if (error === 'rate_limited') return 'Too many alert requests. Try again in an hour.'
  if (error === 'invalid_category') return 'Choose a category from the watchlist.'
  if (error === 'unknown_item') return 'That product is not on the watchlist.'
  if (error === 'unavailable') return 'Deal alerts are not available yet.'
  return 'Choose a product or a category.'
}
