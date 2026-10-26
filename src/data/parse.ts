import { parseRequirementList, parseSpecList } from '../domain/specs'
import type { Deal, DealStatus, EnrichmentStatus, Item, PriceSnapshot, Priority, Store, Verdict } from '../domain/types'

export function parseStoreRow(row: unknown): Store {
  const record = asRecord(row, 'stores')
  return {
    id: requiredString(record, 'id', 'stores'),
    name: requiredString(record, 'name', 'stores'),
    base_url: optionalString(record, 'base_url', 'stores'),
    country: optionalString(record, 'country', 'stores'),
    membership: optionalString(record, 'membership', 'stores'),
    notes: optionalString(record, 'notes', 'stores'),
    enabled: requiredBoolean(record, 'enabled', 'stores'),
    created_at: requiredString(record, 'created_at', 'stores'),
    updated_at: requiredString(record, 'updated_at', 'stores'),
  }
}

export function parseItemRow(row: unknown): Item {
  const record = asRecord(row, 'items')
  return {
    id: requiredString(record, 'id', 'items'),
    name: requiredString(record, 'name', 'items'),
    public_summary: optionalString(record, 'public_summary', 'items'),
    description: optionalString(record, 'description', 'items'),
    category: optionalString(record, 'category', 'items'),
    keywords: keywords(record.keywords),
    target_price: money(record.target_price, 'items', true),
    max_price: money(record.max_price, 'items', true),
    priority: priority(record.priority),
    condition: optionalString(record, 'condition', 'items'),
    notes: optionalString(record, 'notes', 'items'),
    image_url: optionalString(record, 'image_url', 'items'),
    specs: parseSpecList(record.specs),
    requirements: parseRequirementList(record.requirements),
    product_url: optionalString(record, 'product_url', 'items'),
    enrichment_status: enrichmentStatus(record.enrichment_status),
    active: requiredBoolean(record, 'active', 'items'),
    created_at: requiredString(record, 'created_at', 'items'),
    updated_at: requiredString(record, 'updated_at', 'items'),
  }
}

export function parseSnapshotRow(row: unknown): PriceSnapshot {
  const record = asRecord(row, 'price_snapshots')
  const price = money(record.price, 'price_snapshots', false)
  if (price == null) throw new Error('Invalid price_snapshots row.')
  return {
    id: integerId(record.id),
    item_id: requiredString(record, 'item_id', 'price_snapshots'),
    store_id: optionalString(record, 'store_id', 'price_snapshots'),
    product_title: optionalString(record, 'product_title', 'price_snapshots'),
    product_url: optionalString(record, 'product_url', 'price_snapshots'),
    price,
    regular_price: money(record.regular_price, 'price_snapshots', true),
    currency: requiredString(record, 'currency', 'price_snapshots'),
    in_stock: optionalBoolean(record, 'in_stock', 'price_snapshots'),
    member_only: optionalBoolean(record, 'member_only', 'price_snapshots'),
    captured_at: requiredString(record, 'captured_at', 'price_snapshots'),
    sale_ends_at: optionalString(record, 'sale_ends_at', 'price_snapshots'),
    shipping: money(record.shipping, 'price_snapshots', true),
    product_name: optionalString(record, 'product_name', 'price_snapshots'),
    meets_requirements: optionalBoolean(record, 'meets_requirements', 'price_snapshots'),
  }
}

export function parseDealRow(row: unknown): Deal {
  const record = asRecord(row, 'deals')
  const price = money(record.price, 'deals', false)
  if (price == null) throw new Error('Invalid deals row.')
  return {
    id: requiredString(record, 'id', 'deals'),
    item_id: requiredString(record, 'item_id', 'deals'),
    store_id: optionalString(record, 'store_id', 'deals'),
    snapshot_id: record.snapshot_id == null ? null : integerId(record.snapshot_id),
    title: requiredString(record, 'title', 'deals'),
    url: optionalString(record, 'url', 'deals'),
    price,
    regular_price: money(record.regular_price, 'deals', true),
    discount_pct: money(record.discount_pct, 'deals', true),
    score: record.score == null ? null : score(record.score),
    verdict: record.verdict == null ? null : verdict(record.verdict),
    reason: optionalString(record, 'reason', 'deals'),
    notified_at: optionalString(record, 'notified_at', 'deals'),
    expires_at: optionalString(record, 'expires_at', 'deals'),
    status: dealStatus(record.status),
    found_at: requiredString(record, 'found_at', 'deals'),
  }
}

export function isUnusableCredential(error: unknown): boolean {
  if (readCode(error) === 'PGRST301') return true
  const message = readMessage(error).toLowerCase()
  return message.includes('no suitable key') || message.includes('wrong key type')
}

export function isPrivilegeError(error: unknown): boolean {
  if (readCode(error) === '42501') return true
  return readMessage(error).toLowerCase().includes('permission denied')
}

/** A publishable key or a placeholder signature must not be sent as a Bearer token. */
export function isSendableBearer(token: string): boolean {
  if (token.startsWith('sb_publishable_') || token.startsWith('sb_secret_')) return false
  const parts = token.split('.')
  return parts.length === 3 && (parts[2]?.length ?? 0) >= 16
}

export function friendlyError(error: unknown): string {
  if (isUnusableCredential(error)) return 'Could not load your data.'
  if (error instanceof Error && !('code' in error)) return error.message
  const code = readCode(error)
  if (code === '23505') return 'A record with that name already exists.'
  if (code === '23514') return 'One of the values is outside the allowed range.'
  if (code === '42501') return 'You do not have access. Sign in again.'
  const message = readMessage(error)
  if (message.toLowerCase().includes('row-level security')) return 'You do not have access. Sign in again.'
  return message || 'Something went wrong.'
}

function asRecord(value: unknown, table: string): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
  throw new Error(`Invalid ${table} row.`)
}

function requiredString(record: Record<string, unknown>, key: string, table: string): string {
  const value = record[key]
  if (typeof value !== 'string' || value.length === 0) throw new Error(`Invalid ${table} row.`)
  return value
}

function optionalString(record: Record<string, unknown>, key: string, table: string): string | null {
  const value = record[key]
  if (value == null) return null
  if (typeof value !== 'string') throw new Error(`Invalid ${table} row.`)
  return value
}

function requiredBoolean(record: Record<string, unknown>, key: string, table: string): boolean {
  const value = record[key]
  if (typeof value !== 'boolean') throw new Error(`Invalid ${table} row.`)
  return value
}

function optionalBoolean(record: Record<string, unknown>, key: string, table: string): boolean | null {
  const value = record[key]
  if (value == null) return null
  if (typeof value !== 'boolean') throw new Error(`Invalid ${table} row.`)
  return value
}

function money(value: unknown, table: string, optional: boolean): number | null {
  if (value == null) {
    if (optional) return null
    throw new Error(`Invalid ${table} row.`)
  }
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN
  if (!Number.isFinite(parsed)) throw new Error(`Invalid ${table} row.`)
  return parsed
}

function integerId(value: unknown): number {
  if (typeof value === 'number' && Number.isSafeInteger(value)) return value
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const parsed = Number(value)
    if (Number.isSafeInteger(parsed)) return parsed
  }
  throw new Error('Invalid price_snapshots row.')
}

function keywords(value: unknown): string[] {
  if (value == null) return []
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    throw new Error('Invalid items row.')
  }
  return value
}

function enrichmentStatus(value: unknown): EnrichmentStatus {
  if (value == null || value === 'ready') return 'ready'
  if (value === 'pending_enrichment') return 'pending_enrichment'
  return 'ready'
}

function priority(value: unknown): Priority {
  if (value === 'low' || value === 'normal' || value === 'high') return value
  throw new Error('Invalid items row.')
}

function verdict(value: unknown): Verdict {
  if (value === 'must_buy' || value === 'good' || value === 'ok' || value === 'skip') return value
  throw new Error('Invalid deals row.')
}

function dealStatus(value: unknown): DealStatus {
  if (value === 'open' || value === 'bought' || value === 'dismissed' || value === 'expired') return value
  throw new Error('Invalid deals row.')
}

function score(value: unknown): number {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 100) throw new Error('Invalid deals row.')
  return parsed
}

function readCode(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') return error.code
  return ''
}

export function isMissingRelation(error: unknown): boolean {
  const code = readCode(error)
  if (code === 'PGRST205' || code === '42P01') return true
  const message = readMessage(error).toLowerCase()
  return message.includes('schema cache') || message.includes('could not find the table')
}

export function missingColumnName(error: unknown): string | null {
  const message = readMessage(error)
  const quoted = message.match(/could not find the '([a-z_][a-z0-9_]*)' column/i)
  if (quoted?.[1]) return quoted[1]
  const missing = message.match(/column (?:[\w]+\.)?["']?([a-z_][a-z0-9_]*)["']? does not exist/i)
  return missing?.[1] ?? null
}

function readMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') return error.message
  return ''
}
