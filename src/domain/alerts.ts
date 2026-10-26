import { formatCad, safeHttpUrl } from './format.ts'

/** Keep the SQL limits in supabase/migrations/20261025120000_alert_subscriptions.sql aligned with these. */
export const PENDING_PER_EMAIL_PER_HOUR = 5
export const TARGET_PER_HOUR = 10
export const HOUR_MS = 60 * 60 * 1000

export const RESEND_BATCH_SIZE = 100
export const RESEND_MAX_REQUESTS_PER_SECOND = 5
export const RESEND_BATCH_GAP_MS = 200
export const CONFIRM_COOLDOWN_MS = 10 * 60 * 1000

export const DEFAULT_ALERTS_FROM = 'Harbour Deal Alerts <noreply@harieshwar.dev>'
export const DEFAULT_REPLY_TO = 'noreply@harieshwar.dev'
export const DEFAULT_PUBLIC_URL = 'https://harieshwar-ai.github.io/deal-tracker'
export const AUTOMATED_FOOTER = 'This is an automated message from a no-reply address. Replies are not received.'
export const SENDER_IDENTITY = 'Harbour · Hamilton, Ontario'

const EMAIL_RE = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

export type SubscribeError =
  | 'invalid_email'
  | 'choose_one'
  | 'invalid_category'
  | 'invalid_item'
  | 'unknown_item'
  | 'rate_limited'

export type SubscribeDecision =
  | { ok: true; result: 'pending'; action: 'insert' | 'reuse' | 'resubscribe' }
  | { ok: true; result: 'already_confirmed'; action: 'none' }
  | { ok: false; error: SubscribeError }

export interface AlertSubscriptionRow {
  email: string
  itemId: string | null
  category: string | null
  status: 'pending' | 'confirmed' | 'unsubscribed'
  createdAt: string
}

export interface OutboundEmail {
  to: string
  from: string
  replyTo: string
  subject: string
  text: string
  html: string
  headers: Record<string, string>
  idempotencyKey: string
}

export interface ResendPayload {
  from: string
  to: string[]
  subject: string
  text: string
  html: string
  reply_to: string
  headers: Record<string, string>
}

export function normalizeEmail(raw: string | null | undefined): string | null {
  const email = (raw ?? '').trim().toLowerCase()
  if (email.length < 3 || email.length > 320) return null
  if (!EMAIL_RE.test(email)) return null
  return email
}

export function normalizeCategory(raw: string | null | undefined): string | null {
  const category = (raw ?? '').trim().replace(/\s+/g, ' ')
  if (category.length < 1 || category.length > 80) return null
  for (const char of category) {
    const code = char.charCodeAt(0)
    if (code < 32 || code === 127) return null
  }
  return category
}

export function normalizeUuid(raw: string | null | undefined): string | null {
  const id = (raw ?? '').trim().toLowerCase()
  return UUID_RE.test(id) ? id : null
}

export function canonicalPrice(value: number): string | null {
  if (!Number.isFinite(value) || value < 0 || value > 99_999_999) return null
  return value.toFixed(2)
}

export function decideSubscribe(input: {
  email: string
  itemId: string | null
  category: string | null
  now: Date
  itemExists: boolean
  /** True only when the category is stored on an active item. */
  categoryActive: boolean
  existing: AlertSubscriptionRow[]
}): SubscribeDecision {
  const email = normalizeEmail(input.email)
  if (!email) return { ok: false, error: 'invalid_email' }

  const rawItem = (input.itemId ?? '').trim()
  const rawCategory = (input.category ?? '').trim()
  if ((rawItem && rawCategory) || (!rawItem && !rawCategory)) return { ok: false, error: 'choose_one' }

  let itemId: string | null = null
  let category: string | null = null
  if (rawItem) {
    itemId = normalizeUuid(rawItem)
    if (!itemId) return { ok: false, error: 'invalid_item' }
    if (!input.itemExists) return { ok: false, error: 'unknown_item' }
  } else {
    category = normalizeCategory(rawCategory)
    if (!category || input.categoryActive !== true) return { ok: false, error: 'invalid_category' }
  }

  const cutoff = input.now.getTime() - HOUR_MS
  const current = input.existing.find((row) => sameTarget(row, email, itemId, category))
  if (current?.status === 'confirmed') return { ok: true, result: 'already_confirmed', action: 'none' }
  if (current?.status === 'pending') return { ok: true, result: 'pending', action: 'reuse' }

  const pendingCount = input.existing.filter((row) => (
    row.email.trim().toLowerCase() === email && row.status === 'pending' && inWindow(row.createdAt, cutoff)
  )).length
  if (pendingCount >= PENDING_PER_EMAIL_PER_HOUR) return { ok: false, error: 'rate_limited' }

  const targetCount = input.existing.filter((row) => inWindow(row.createdAt, cutoff) && (
    itemId ? row.itemId === itemId : row.category === category
  )).length
  if (targetCount >= TARGET_PER_HOUR) return { ok: false, error: 'rate_limited' }

  if (current?.status === 'unsubscribed') return { ok: true, result: 'pending', action: 'resubscribe' }
  return { ok: true, result: 'pending', action: 'insert' }
}

export function parseSubscribeResult(data: unknown): { ok: true; result: 'pending' | 'already_confirmed'; subscriptionId: string } | { ok: false; error: SubscribeError | 'unavailable' } {
  if (!data || typeof data !== 'object') return { ok: false, error: 'unavailable' }
  const row = data as { ok?: unknown; result?: unknown; error?: unknown; subscription_id?: unknown }
  if (row.ok === true && (row.result === 'pending' || row.result === 'already_confirmed') && typeof row.subscription_id === 'string' && normalizeUuid(row.subscription_id)) {
    return { ok: true, result: row.result, subscriptionId: row.subscription_id.toLowerCase() }
  }
  if (
    row.error === 'invalid_email'
    || row.error === 'choose_one'
    || row.error === 'invalid_category'
    || row.error === 'invalid_item'
    || row.error === 'unknown_item'
    || row.error === 'rate_limited'
  ) {
    return { ok: false, error: row.error }
  }
  return { ok: false, error: 'unavailable' }
}

export type TokenOutcome =
  | { ok: true; result: 'confirmed' | 'already_confirmed' | 'unsubscribed'; category: string | null; itemId: string | null }
  | { ok: false; error: 'invalid_token' | 'unavailable' }

export function parseTokenResult(data: unknown, kind: 'confirm' | 'unsubscribe'): TokenOutcome {
  if (!data || typeof data !== 'object') return { ok: false, error: 'unavailable' }
  const row = data as { ok?: unknown; result?: unknown; error?: unknown; category?: unknown; item_id?: unknown }
  if (row.error === 'invalid_token') return { ok: false, error: 'invalid_token' }
  const category = typeof row.category === 'string' ? row.category : null
  const itemId = typeof row.item_id === 'string' && normalizeUuid(row.item_id) ? row.item_id.toLowerCase() : null
  if (kind === 'confirm' && row.ok === true && (row.result === 'confirmed' || row.result === 'already_confirmed')) {
    return { ok: true, result: row.result, category, itemId }
  }
  if (kind === 'unsubscribe' && row.ok === true && row.result === 'unsubscribed') {
    return { ok: true, result: 'unsubscribed', category, itemId }
  }
  return { ok: false, error: 'unavailable' }
}

export function idempotencyKeyForDeal(part: {
  subscriptionId: string
  itemId: string
  storeId: string | null
  price: string
}): string {
  const subscriptionId = normalizeUuid(part.subscriptionId)
  const itemId = normalizeUuid(part.itemId)
  const storeId = part.storeId == null || part.storeId === '' ? 'none' : normalizeUuid(part.storeId)
  if (!subscriptionId || !itemId || !storeId || !/^\d+\.\d{2}$/.test(part.price)) {
    throw new Error('Invalid alert idempotency key.')
  }
  return `deal:${subscriptionId}:${itemId}:${storeId}:${part.price}`
}

export function idempotencyKeyForConfirm(subscriptionId: string): string {
  const id = normalizeUuid(subscriptionId)
  if (!id) throw new Error('Invalid confirmation key.')
  return `confirm:${id}`
}

export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (size < 1) throw new Error('Batch size must be at least 1.')
  const groups: T[][] = []
  for (let index = 0; index < items.length; index += size) groups.push(items.slice(index, index + size))
  return groups
}

export function planResendBatches(messages: readonly OutboundEmail[]): OutboundEmail[][] {
  const unique = new Map<string, OutboundEmail>()
  for (const message of messages) unique.set(message.idempotencyKey, message)
  const sorted = [...unique.values()].sort((left, right) => left.idempotencyKey.localeCompare(right.idempotencyKey))
  return chunk(sorted, RESEND_BATCH_SIZE)
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Resend keeps one Idempotency-Key per HTTP request. A single alert uses its
 * own key. A batch uses a digest of the sorted per-alert keys so the same
 * chunk can be retried without sending twice.
 */
export async function resendIdempotencyHeader(keys: readonly string[]): Promise<string> {
  if (keys.length === 0) throw new Error('An alert batch needs at least one idempotency key.')
  if (keys.length === 1) return keys[0] ?? ''
  return `batch:${await sha256Hex([...keys].sort().join('\n'))}`
}

export function retryDelayMs(retryAfter: string | null, attempt: number): number {
  const parsed = retryAfter == null ? Number.NaN : Number(retryAfter)
  if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 60) return parsed * 1000
  return Math.min(8_000, 1_000 * 2 ** attempt)
}

export function chooseMailAdapter(env: {
  resendApiKey?: string | null
  smtpHost?: string | null
  smtpPort?: string | null
  smtpUser?: string | null
  smtpPass?: string | null
}): 'resend' | 'smtp' | 'none' {
  if ((env.resendApiKey ?? '').trim()) return 'resend'
  const port = Number((env.smtpPort ?? '').trim())
  if ((env.smtpHost ?? '').trim() && (env.smtpUser ?? '').trim() && (env.smtpPass ?? '').trim() && Number.isInteger(port) && port > 0 && port <= 65535) {
    return 'smtp'
  }
  return 'none'
}

export function resolveFrom(configured: string | null | undefined): string {
  const value = (configured ?? '').trim()
  return value || DEFAULT_ALERTS_FROM
}

export function publicPageUrl(base: string | null | undefined, page: 'confirm' | 'unsubscribe', token: string): string {
  const url = new URL(`${siteBase(base)}/${page}`)
  url.searchParams.set('token', token)
  return url.toString()
}

export function itemPublicUrl(base: string | null | undefined, itemId: string): string {
  return `${siteBase(base)}/items/${itemId}`
}

export function alertHeaders(unsubscribeUrl: string): Record<string, string> {
  return {
    'Auto-Submitted': 'auto-generated',
    'X-Auto-Response-Suppress': 'All',
    'List-Unsubscribe': `<${unsubscribeUrl}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  }
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

/** PostgREST `column=eq.value` filter segment (value is URL-encoded; no JSON quotes). */
export function postgrestEqFilter(column: string, value: string): string {
  return `${column}=eq.${encodeURIComponent(value)}`
}

export interface AlertSubscriberRow {
  id: string
}

export function mergeAlertSubscribers<T extends AlertSubscriberRow>(
  byItem: readonly T[],
  byCategory: readonly (readonly T[])[],
): T[] {
  const seen = new Set(byItem.map((row) => row.id))
  const extra: T[] = []
  for (const rows of byCategory) {
    for (const row of rows) {
      if (seen.has(row.id)) continue
      seen.add(row.id)
      extra.push(row)
    }
  }
  return [...byItem, ...extra]
}

/** Public store link for a deal alert: deal URL, then snapshot, then item, then store home. */
export function resolveDealStoreUrl(candidates: {
  dealUrl?: string | null
  snapshotProductUrl?: string | null
  itemProductUrl?: string | null
  storeBaseUrl?: string | null
}): string | null {
  for (const value of [
    candidates.dealUrl,
    candidates.snapshotProductUrl,
    candidates.itemProductUrl,
    candidates.storeBaseUrl,
  ]) {
    const url = safeHttpUrl(value)
    if (url) return url
  }
  return null
}

export function composeConfirmation(input: {
  to: string
  from?: string
  targetLabel: string
  confirmUrl: string
  unsubscribeUrl: string
  idempotencyKey: string
}): OutboundEmail {
  const target = oneLine(input.targetLabel) || 'this alert'
  const subject = 'Confirm your Harbour deal alerts'
  const text = [
    `Confirm deal alerts for ${target}.`,
    '',
    input.confirmUrl,
    '',
    `Unsubscribe: ${input.unsubscribeUrl}`,
    '',
    SENDER_IDENTITY,
    AUTOMATED_FOOTER,
  ].join('\n')
  const html = mailHtml(
    `<p>Confirm deal alerts for ${escapeHtml(target)}.</p><p><a href="${escapeHtml(input.confirmUrl)}">Confirm alerts</a></p><p><a href="${escapeHtml(input.unsubscribeUrl)}">Unsubscribe</a></p>`,
  )
  return seal(input.to, input.from, subject, text, html, input.unsubscribeUrl, input.idempotencyKey)
}

export function composeDealAlert(input: {
  to: string
  from?: string
  productName: string
  price: number
  storeName: string | null
  summary: string | null
  itemUrl: string
  storeUrl: string | null
  unsubscribeUrl: string
  idempotencyKey: string
}): OutboundEmail {
  const product = oneLine(input.productName) || 'A watched product'
  const price = formatCad(input.price)
  const store = input.storeName ? oneLine(input.storeName) : ''
  const summary = (input.summary ?? '').trim().replace(/\s+/g, ' ').slice(0, 500)
  const storeUrl = safeHttpUrl(input.storeUrl)
  const itemUrl = safeHttpUrl(input.itemUrl)
  const offer = store ? `${product} is ${price} at ${store}.` : `${product} is ${price}.`
  const subject = oneLine(store ? `${product} is ${price} at ${store}` : `${product} is ${price}`)
  const lines = [offer]
  if (summary) lines.push(summary)
  if (itemUrl) lines.push(`Harbour: ${itemUrl}`)
  if (storeUrl) lines.push(`Store: ${storeUrl}`)
  lines.push('', `Unsubscribe: ${input.unsubscribeUrl}`, '', SENDER_IDENTITY, AUTOMATED_FOOTER)
  const text = lines.join('\n')
  const links = [
    itemUrl ? `<p><a href="${escapeHtml(itemUrl)}">View on Harbour</a></p>` : '',
    storeUrl ? `<p><a href="${escapeHtml(storeUrl)}">Store page</a></p>` : '',
    `<p><a href="${escapeHtml(input.unsubscribeUrl)}">Unsubscribe</a></p>`,
  ].join('')
  const html = mailHtml(`<p>${escapeHtml(offer)}</p>${summary ? `<p>${escapeHtml(summary)}</p>` : ''}${links}`)
  return seal(input.to, input.from, subject, text, html, input.unsubscribeUrl, input.idempotencyKey)
}

export function resendPayload(message: OutboundEmail): ResendPayload {
  return {
    from: message.from,
    to: [message.to],
    subject: message.subject,
    text: message.text,
    html: message.html,
    reply_to: message.replyTo,
    headers: message.headers,
  }
}

export function mailboxAddress(value: string): string | null {
  const match = value.match(/<([^<>]+)>/)
  return normalizeEmail((match?.[1] ?? value).trim())
}

export function encodeRfc822(message: OutboundEmail): string {
  const headers = [
    `From: ${headerValue(message.from)}`,
    `To: ${headerValue(message.to)}`,
    `Subject: ${headerValue(message.subject)}`,
    `Reply-To: ${headerValue(message.replyTo)}`,
    'MIME-Version: 1.0',
    'Content-Type: multipart/alternative; boundary="harbour-alert"',
    ...Object.entries(message.headers).map(([name, value]) => `${name}: ${headerValue(value)}`),
  ]
  const body = [
    '--harbour-alert',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    message.text,
    '--harbour-alert',
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    message.html,
    '--harbour-alert--',
    '',
  ].join('\r\n')
  return `${headers.join('\r\n')}\r\n\r\n${body}`
    .split('\r\n')
    .map((line) => (line.startsWith('.') ? `.${line}` : line))
    .join('\r\n')
}

export interface SubscriberListItem {
  id: string
  email: string
  itemId: string | null
  category: string | null
  status: 'pending' | 'confirmed' | 'unsubscribed'
}

export function subscriberCounts(rows: readonly SubscriberListItem[]): {
  pending: number
  confirmed: number
  unsubscribed: number
  byCategory: { category: string; count: number }[]
  byItem: { itemId: string; count: number }[]
} {
  const byCategory = new Map<string, number>()
  const byItem = new Map<string, number>()
  let pending = 0
  let confirmed = 0
  let unsubscribed = 0
  for (const row of rows) {
    if (row.status === 'pending') pending += 1
    else if (row.status === 'confirmed') confirmed += 1
    else unsubscribed += 1
    if (row.category) byCategory.set(row.category, (byCategory.get(row.category) ?? 0) + 1)
    if (row.itemId) byItem.set(row.itemId, (byItem.get(row.itemId) ?? 0) + 1)
  }
  return {
    pending,
    confirmed,
    unsubscribed,
    byCategory: ranked(byCategory, 'category'),
    byItem: ranked(byItem, 'itemId'),
  }
}

export function secretsMatch(left: string, right: string): boolean {
  if (left.length !== right.length) return false
  let diff = 0
  for (let index = 0; index < left.length; index += 1) diff |= left.charCodeAt(index) ^ right.charCodeAt(index)
  return diff === 0
}

function ranked<Key extends string>(counts: Map<string, number>, key: Key): Array<Record<Key, string> & { count: number }> {
  return [...counts.entries()]
    .map(([name, count]) => ({ [key]: name, count }) as Record<Key, string> & { count: number })
    .sort((left, right) => right.count - left.count || String(left[key]).localeCompare(String(right[key])))
}

function sameTarget(row: AlertSubscriptionRow, email: string, itemId: string | null, category: string | null): boolean {
  if (row.email.trim().toLowerCase() !== email) return false
  if (itemId) return row.itemId === itemId
  return row.category === category
}

function inWindow(iso: string, cutoff: number): boolean {
  const time = Date.parse(iso)
  return Number.isFinite(time) && time > cutoff
}

function siteBase(base: string | null | undefined): string {
  const candidate = (base ?? '').trim() || DEFAULT_PUBLIC_URL
  try {
    const url = new URL(candidate)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return DEFAULT_PUBLIC_URL
    return url.toString().replace(/\/$/, '')
  } catch {
    return DEFAULT_PUBLIC_URL
  }
}

function seal(
  to: string,
  from: string | undefined,
  subject: string,
  text: string,
  html: string,
  unsubscribeUrl: string,
  idempotencyKey: string,
): OutboundEmail {
  return {
    to,
    from: resolveFrom(from),
    replyTo: DEFAULT_REPLY_TO,
    subject,
    text,
    html,
    headers: alertHeaders(unsubscribeUrl),
    idempotencyKey,
  }
}

function mailHtml(body: string): string {
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;line-height:1.5;color:#1c1917">${body}<p style="color:#57534e;font-size:13px">${escapeHtml(SENDER_IDENTITY)}<br>${escapeHtml(AUTOMATED_FOOTER)}</p></body></html>`
}

function oneLine(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim()
}

function headerValue(value: string): string {
  const clean = oneLine(value)
  if (/^[\u0020-\u007e]*$/.test(clean)) return clean
  const bytes = new TextEncoder().encode(clean)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return `=?UTF-8?B?${btoa(binary)}?=`
}
