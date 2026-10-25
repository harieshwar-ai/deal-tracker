import { OWNER_USER_ID } from '../../../src/auth/owner.ts'
import {
  CONFIRM_COOLDOWN_MS,
  canonicalPrice,
  composeConfirmation,
  composeDealAlert,
  idempotencyKeyForConfirm,
  idempotencyKeyForDeal,
  itemPublicUrl,
  normalizeCategory,
  normalizeEmail,
  normalizeUuid,
  publicPageUrl,
  resolveFrom,
  secretsMatch,
} from '../../../src/domain/alerts.ts'
import { safeHttpUrl } from '../../../src/domain/format.ts'
import { deliver } from './deliver.ts'

interface SubscriptionRow {
  id: string
  email: string
  status: string
  confirm_token: string
  unsubscribe_token: string
  item_id: string | null
  category: string | null
}

interface ItemRow {
  id: string
  name: string
  category: string | null
  public_summary: string | null
  product_url: string | null
}

interface SentRow {
  subscription_id: string
  store_id: string | null
}

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, apikey, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
}

const runtime = (globalThis as { Deno?: { serve: (handler: (request: Request) => Promise<Response>) => void } }).Deno
runtime?.serve(async (request) => {
  try {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
    if (request.method !== 'POST') return json({ ok: false, error: 'method' }, 405)
    const body = await request.json().catch(() => null) as { action?: unknown } | null
    if (body?.action === 'confirm') return await confirm(body)
    if (body?.action === 'deal') return await deal(request, body)
    return json({ ok: false, error: 'unknown_action' }, 400)
  } catch (error) {
    console.log(JSON.stringify({ event: 'alerts_failed', reason: error instanceof Error ? error.name : 'error' }))
    return json({ ok: false, error: 'unavailable' }, 500)
  }
})

async function confirm(body: unknown): Promise<Response> {
  const parsed = parseConfirm(body)
  if ('error' in parsed) return json({ ok: false, error: parsed.error }, 400)
  const row = await findSubscription(parsed.subscriptionId)
  if (!row || normalizeEmail(row.email) !== parsed.email || row.status !== 'pending') {
    return json({ ok: false, error: 'not_found' }, 404)
  }
  if (await confirmOnCooldown(row.id)) return json({ ok: true, sent: false, reason: 'cooldown' })
  const from = resolveFrom(runtimeEnv('ALERTS_FROM'))
  const base = runtimeEnv('ALERTS_PUBLIC_URL')
  const message = composeConfirmation({
    to: row.email,
    from,
    targetLabel: await targetLabel(row),
    confirmUrl: publicPageUrl(base, 'confirm', row.confirm_token),
    unsubscribeUrl: publicPageUrl(base, 'unsubscribe', row.unsubscribe_token),
    idempotencyKey: idempotencyKeyForConfirm(row.id),
  })
  const outcome = await deliver([message])
  const result = outcome.results[0]
  if (outcome.reason === 'unconfigured') return json({ ok: true, sent: false, reason: 'unconfigured' })
  await logNotification({
    subscription_id: row.id,
    item_id: null,
    store_id: null,
    price: null,
    kind: 'confirm',
    status: result?.ok ? 'sent' : 'failed',
    idempotency_key: message.idempotencyKey,
    detail: result?.detail ?? null,
  })
  console.log(JSON.stringify({ event: 'alert_confirm', sent: Boolean(result?.ok) }))
  return json({ ok: true, sent: Boolean(result?.ok) })
}

async function deal(request: Request, body: unknown): Promise<Response> {
  if (!await callerAllowed(request)) return json({ ok: false, error: 'unauthorized' }, 401)
  const parsed = parseDeal(body)
  if ('error' in parsed) return json({ ok: false, error: parsed.error }, 400)
  const item = await findItem(parsed.itemId)
  if (!item) return json({ ok: false, error: 'unknown_item' }, 404)
  const storeName = parsed.storeId ? await findStoreName(parsed.storeId) : null
  if (parsed.storeId && !storeName) return json({ ok: false, error: 'unknown_store' }, 404)
  const subscribers = await confirmedSubscribers(item.id, item.category)
  const already = await sentDeals(item.id, parsed.price)
  const from = resolveFrom(runtimeEnv('ALERTS_FROM'))
  const base = runtimeEnv('ALERTS_PUBLIC_URL')
  const pending = []
  let skipped = 0
  for (const subscriber of subscribers) {
    if (already.has(sentKey(subscriber.id, parsed.storeId))) {
      skipped += 1
      continue
    }
    const key = idempotencyKeyForDeal({
      subscriptionId: subscriber.id,
      itemId: item.id,
      storeId: parsed.storeId,
      price: parsed.price,
    })
    pending.push({
      subscriber,
      message: composeDealAlert({
        to: subscriber.email,
        from,
        productName: item.name,
        price: Number(parsed.price),
        storeName,
        summary: item.public_summary,
        itemUrl: itemPublicUrl(base, item.id),
        storeUrl: safeHttpUrl(item.product_url),
        unsubscribeUrl: publicPageUrl(base, 'unsubscribe', subscriber.unsubscribe_token),
        idempotencyKey: key,
      }),
    })
  }
  if (pending.length === 0) return json({ ok: true, sent: 0, failed: 0, skipped })
  const outcome = await deliver(pending.map((entry) => entry.message))
  if (outcome.reason === 'unconfigured') return json({ ok: true, sent: 0, failed: 0, skipped, reason: 'unconfigured' })
  let sent = 0
  let failed = 0
  for (const entry of pending) {
    const result = outcome.results.find((itemResult) => itemResult.idempotencyKey === entry.message.idempotencyKey)
    const ok = Boolean(result?.ok)
    if (ok) sent += 1
    else failed += 1
    await logNotification({
      subscription_id: entry.subscriber.id,
      item_id: item.id,
      store_id: parsed.storeId,
      price: Number(parsed.price),
      kind: 'deal',
      status: ok ? 'sent' : 'failed',
      idempotency_key: entry.message.idempotencyKey,
      detail: result?.detail ?? null,
    })
    if (ok) await touchNotified(entry.subscriber.id)
  }
  console.log(JSON.stringify({ event: 'alert_deal', sent, failed, skipped }))
  return json({ ok: true, sent, failed, skipped })
}

function parseConfirm(body: unknown): { subscriptionId: string; email: string } | { error: string } {
  const row = body as { subscription_id?: unknown; email?: unknown }
  const subscriptionId = typeof row?.subscription_id === 'string' ? normalizeUuid(row.subscription_id) : null
  const email = typeof row?.email === 'string' ? normalizeEmail(row.email) : null
  if (!subscriptionId || !email) return { error: 'invalid_confirm' }
  return { subscriptionId, email }
}

function parseDeal(body: unknown): { itemId: string; storeId: string | null; price: string } | { error: string } {
  const row = body as { item_id?: unknown; store_id?: unknown; price?: unknown }
  const itemId = typeof row?.item_id === 'string' ? normalizeUuid(row.item_id) : null
  if (!itemId) return { error: 'invalid_item' }
  let storeId: string | null = null
  if (row.store_id != null && row.store_id !== '') {
    if (typeof row.store_id !== 'string') return { error: 'invalid_store' }
    storeId = normalizeUuid(row.store_id)
    if (!storeId) return { error: 'invalid_store' }
  }
  const price = typeof row.price === 'number' ? canonicalPrice(row.price) : null
  if (!price) return { error: 'invalid_price' }
  return { itemId, storeId, price }
}

async function callerAllowed(request: Request): Promise<boolean> {
  const header = request.headers.get('authorization') ?? ''
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : ''
  if (!token) return false
  const service = runtimeEnv('SUPABASE_SERVICE_ROLE_KEY')
  if (service && secretsMatch(token, service)) return true
  const url = runtimeEnv('SUPABASE_URL')
  const anon = runtimeEnv('SUPABASE_ANON_KEY') || service
  if (!url || !anon) return false
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: anon },
  })
  if (!response.ok) return false
  const user = await response.json().catch(() => null) as { id?: unknown } | null
  return user?.id === OWNER_USER_ID
}

async function findSubscription(id: string): Promise<SubscriptionRow | null> {
  const rows = await restGet<SubscriptionRow[]>(
    `alert_subscriptions?id=eq.${id}&select=id,email,status,confirm_token,unsubscribe_token,item_id,category&limit=1`,
  )
  return rows[0] ?? null
}

async function confirmOnCooldown(id: string): Promise<boolean> {
  const rows = await restGet<{ sent_at: string }[]>(
    `alert_notifications?subscription_id=eq.${id}&kind=eq.confirm&status=eq.sent&select=sent_at&order=sent_at.desc&limit=1`,
  )
  const sentAt = rows[0]?.sent_at
  if (!sentAt) return false
  return Date.now() - Date.parse(sentAt) < CONFIRM_COOLDOWN_MS
}

async function targetLabel(row: SubscriptionRow): Promise<string> {
  if (row.item_id) {
    const item = await findItem(row.item_id)
    return item?.name || 'this product'
  }
  return normalizeCategory(row.category) || 'this category'
}

async function findItem(id: string): Promise<ItemRow | null> {
  const rows = await restGet<ItemRow[]>(
    `items?id=eq.${id}&select=id,name,category,public_summary,product_url&limit=1`,
  )
  return rows[0] ?? null
}

async function findStoreName(id: string): Promise<string | null> {
  const rows = await restGet<{ name: string }[]>(`stores?id=eq.${id}&select=name&limit=1`)
  return rows[0]?.name ?? null
}

async function confirmedSubscribers(itemId: string, category: string | null): Promise<SubscriptionRow[]> {
  const select = 'id,email,status,confirm_token,unsubscribe_token,item_id,category'
  const byItem = await restGet<SubscriptionRow[]>(
    `alert_subscriptions?status=eq.confirmed&item_id=eq.${itemId}&select=${select}`,
  )
  if (!category) return byItem
  const byCategory = await restGet<SubscriptionRow[]>(
    `alert_subscriptions?status=eq.confirmed&${eqFilter('category', category)}&select=${select}`,
  )
  const seen = new Set(byItem.map((row) => row.id))
  return [...byItem, ...byCategory.filter((row) => !seen.has(row.id))]
}

async function sentDeals(itemId: string, price: string): Promise<Set<string>> {
  const rows = await restGet<SentRow[]>(
    `alert_notifications?kind=eq.deal&status=eq.sent&item_id=eq.${itemId}&price=eq.${price}&select=subscription_id,store_id`,
  )
  return new Set(rows.map((row) => sentKey(row.subscription_id, row.store_id)))
}

async function logNotification(row: {
  subscription_id: string
  item_id: string | null
  store_id: string | null
  price: number | null
  kind: 'confirm' | 'deal'
  status: 'sent' | 'failed'
  idempotency_key: string
  detail: string | null
}): Promise<void> {
  const response = await restFetch('alert_notifications', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify([{ ...row, detail: row.detail?.slice(0, 500) ?? null }]),
  })
  if (!response.ok && response.status !== 409) {
    console.log(JSON.stringify({ event: 'alert_log_failed', status: response.status }))
  }
}

async function touchNotified(id: string): Promise<void> {
  await restFetch(`alert_subscriptions?id=eq.${id}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ last_notified_at: new Date().toISOString() }),
  })
}

async function restGet<T>(path: string): Promise<T> {
  const response = await restFetch(path, { method: 'GET' })
  if (!response.ok) throw new Error(`db_${response.status}`)
  return response.json() as Promise<T>
}

async function restFetch(path: string, init: { method: string; headers?: Record<string, string>; body?: string }): Promise<Response> {
  const url = runtimeEnv('SUPABASE_URL')
  const key = runtimeEnv('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) throw new Error('db_unconfigured')
  return fetch(`${url}/rest/v1/${path}`, {
    method: init.method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'content-type': 'application/json',
      ...init.headers,
    },
    body: init.body,
  })
}

function eqFilter(column: string, value: string): string {
  return `${column}=eq.${encodeURIComponent(`"${value.replaceAll('"', '""')}"`)}`
}

function sentKey(subscriptionId: string, storeId: string | null): string {
  return `${subscriptionId}:${storeId ?? 'none'}`
}

function runtimeEnv(name: string): string {
  return (globalThis as { Deno?: { env: { get(key: string): string | undefined } } }).Deno?.env.get(name) ?? ''
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'content-type': 'application/json' },
  })
}
