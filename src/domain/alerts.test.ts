// @ts-expect-error TS2591 — node:fs is available when Vitest runs the test.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { alertMatchCategories, categoryLabel } from './labels'
import {
  AUTOMATED_FOOTER,
  DEFAULT_ALERTS_FROM,
  DEFAULT_REPLY_TO,
  PENDING_PER_EMAIL_PER_HOUR,
  RESEND_BATCH_SIZE,
  TARGET_PER_HOUR,
  canonicalPrice,
  chooseMailAdapter,
  parseTokenResult,
  composeConfirmation,
  composeDealAlert,
  decideSubscribe,
  mergeAlertSubscribers,
  postgrestEqFilter,
  resolveDealStoreUrl,
  encodeRfc822,
  idempotencyKeyForConfirm,
  idempotencyKeyForDeal,
  filterSubscribersForCountry,
  parseSubscribeResult,
  planResendBatches,
  resendIdempotencyHeader,
  resendPayload,
  retryDelayMs,
  subscriberCounts,
  type AlertSubscriptionRow,
  type OutboundEmail,
} from './alerts'

const now = new Date('2026-10-25T15:00:00.000Z')
const itemId = '11111111-1111-4111-8111-111111111111'
const otherItem = '22222222-2222-4222-8222-222222222222'
const storeId = '33333333-3333-4333-8333-333333333333'
const subscriptionId = '44444444-4444-4444-8444-444444444444'

function row(overrides: Partial<AlertSubscriptionRow> = {}): AlertSubscriptionRow {
  return {
    email: 'ada@example.com',
    itemId: null,
    category: 'gpu',
    status: 'pending',
    createdAt: '2026-10-25T14:30:00.000Z',
    ...overrides,
  }
}

function message(key: string): OutboundEmail {
  return composeConfirmation({
    to: 'ada@example.com',
    targetLabel: 'GPU',
    confirmUrl: 'https://harieshwar-ai.github.io/deal-tracker/confirm?token=abc',
    unsubscribeUrl: 'https://harieshwar-ai.github.io/deal-tracker/unsubscribe?token=def',
    idempotencyKey: key,
  })
}

describe('confirmation idempotency', () => {
  it('includes the confirm token so resubscribe can send again', () => {
    const token = 'a'.repeat(64)
    expect(idempotencyKeyForConfirm(subscriptionId, token)).toBe(`confirm:${subscriptionId}:${token.slice(0, 48)}`)
    expect(idempotencyKeyForConfirm(subscriptionId, token)).not.toBe(idempotencyKeyForConfirm(subscriptionId, 'b'.repeat(64)))
  })
})

describe('subscriber country matching', () => {
  it('keeps only subscribers for the deal store country', () => {
    const rows = [
      { id: '1', country_code: 'CA' },
      { id: '2', country_code: 'US' },
      { id: '3', country_code: null },
    ]
    expect(filterSubscribersForCountry(rows, 'CA').map((row) => row.id)).toEqual(['1', '3'])
  })
})

describe('subscribe decisions', () => {
  it('accepts one normalized target and rejects the rest', () => {
    expect(decideSubscribe({
      email: ' Ada@Example.com ',
      itemId: null,
      category: '  gpu  ',
      now,
      itemExists: false,
      categoryActive: true,
      existing: [],
    })).toEqual({ ok: true, result: 'pending', action: 'insert' })
    expect(decideSubscribe({
      email: 'not-an-email',
      itemId: null,
      category: 'gpu',
      now,
      itemExists: false,
      categoryActive: true,
      existing: [],
    }).ok).toBe(false)
    expect(decideSubscribe({
      email: 'ada@example.com',
      itemId,
      category: 'gpu',
      now,
      itemExists: true,
      categoryActive: true,
      existing: [],
    })).toMatchObject({ ok: false, error: 'choose_one' })
    expect(decideSubscribe({
      email: 'ada@example.com',
      itemId: 'nope',
      category: null,
      now,
      itemExists: true,
      categoryActive: true,
      existing: [],
    })).toMatchObject({ ok: false, error: 'invalid_item' })
    expect(decideSubscribe({
      email: 'ada@example.com',
      itemId,
      category: null,
      now,
      itemExists: false,
      categoryActive: true,
      existing: [],
    })).toMatchObject({ ok: false, error: 'unknown_item' })
    expect(decideSubscribe({
      email: 'ada@example.com',
      itemId: null,
      category: 'gpu',
      now,
      itemExists: false,
      categoryActive: false,
      existing: [],
    })).toMatchObject({ ok: false, error: 'invalid_category' })
  })

  it('reuses a pending row, reports a confirmed row, and reopens an unsubscribed row', () => {
    expect(decideSubscribe({
      email: 'ada@example.com',
      itemId: null,
      category: 'gpu',
      now,
      itemExists: false,
      categoryActive: true,
      existing: [row()],
    })).toEqual({ ok: true, result: 'pending', action: 'reuse' })
    expect(decideSubscribe({
      email: 'ada@example.com',
      itemId: null,
      category: 'gpu',
      now,
      itemExists: false,
      categoryActive: true,
      existing: [row({ status: 'confirmed' })],
    })).toEqual({ ok: true, result: 'already_confirmed', action: 'none' })
    expect(decideSubscribe({
      email: 'ada@example.com',
      itemId: null,
      category: 'gpu',
      now,
      itemExists: false,
      categoryActive: true,
      existing: [row({ status: 'unsubscribed', createdAt: '2026-10-20T15:00:00.000Z' })],
    })).toEqual({ ok: true, result: 'pending', action: 'resubscribe' })
  })

  it('limits pending addresses and new targets per hour', () => {
    const pending = Array.from({ length: PENDING_PER_EMAIL_PER_HOUR }, (_, index) => row({
      category: `cat-${index}`,
    }))
    expect(decideSubscribe({
      email: 'ada@example.com',
      itemId: null,
      category: 'ssd',
      now,
      itemExists: false,
      categoryActive: true,
      existing: pending,
    })).toMatchObject({ ok: false, error: 'rate_limited' })

    const crowded = Array.from({ length: TARGET_PER_HOUR }, (_, index) => row({
      email: `person-${index}@example.com`,
      itemId,
      category: null,
    }))
    expect(decideSubscribe({
      email: 'new@example.com',
      itemId,
      category: null,
      now,
      itemExists: true,
      categoryActive: true,
      existing: crowded,
    })).toMatchObject({ ok: false, error: 'rate_limited' })

    const expired = row({ createdAt: '2026-10-25T14:00:00.000Z', category: 'ram' })
    expect(decideSubscribe({
      email: 'ada@example.com',
      itemId: null,
      category: 'ssd',
      now,
      itemExists: false,
      categoryActive: true,
      existing: [expired],
    })).toEqual({ ok: true, result: 'pending', action: 'insert' })
  })
})

describe('alert subscriber matching', () => {
  it('builds PostgREST category filters without JSON quotes', () => {
    expect(postgrestEqFilter('category', 'Prebuilt PCs')).toBe('category=eq.Prebuilt%20PCs')
    expect(postgrestEqFilter('category', 'group:pc-hardware')).toBe('category=eq.group%3Apc-hardware')
    expect(postgrestEqFilter('category', 'Graphics cards')).toBe('category=eq.Graphics%20cards')
    expect(postgrestEqFilter('category', 'Prebuilt PCs')).not.toContain('"')
  })

  it('merges item, category, and group subscribers without duplicates', () => {
    const itemSubscriber = { id: 'sub-item', email: 'item@example.com' }
    const categorySubscriber = { id: 'sub-cat', email: 'cat@example.com' }
    const groupSubscriber = { id: 'sub-group', email: 'group@example.com' }
    const duplicate = { id: 'sub-item', email: 'item@example.com' }
    const categories = alertMatchCategories('Prebuilt PCs')
    expect(categories).toEqual(['Prebuilt PCs', 'group:pc-hardware'])
    const byCategory = categories.map((category) => {
      if (category === 'Prebuilt PCs') return [categorySubscriber, duplicate]
      return [groupSubscriber]
    })
    const merged = mergeAlertSubscribers([itemSubscriber], byCategory)
    expect(merged.map((row) => row.id)).toEqual(['sub-item', 'sub-cat', 'sub-group'])
    const categoryOnly = mergeAlertSubscribers([], [[categorySubscriber], [groupSubscriber]])
    expect(categoryOnly.map((row) => row.id)).toEqual(['sub-cat', 'sub-group'])
  })
})

describe('deal store links', () => {
  it('prefers deal and snapshot URLs over the item product link', () => {
    expect(resolveDealStoreUrl({
      dealUrl: 'https://shop.example/deal',
      snapshotProductUrl: 'https://shop.example/snap',
      itemProductUrl: 'https://shop.example/item',
      storeBaseUrl: 'https://shop.example/',
    })).toBe('https://shop.example/deal')
    expect(resolveDealStoreUrl({
      dealUrl: null,
      snapshotProductUrl: 'https://shop.example/snap',
      itemProductUrl: 'https://shop.example/item',
      storeBaseUrl: 'https://shop.example/',
    })).toBe('https://shop.example/snap')
    expect(resolveDealStoreUrl({
      dealUrl: null,
      snapshotProductUrl: null,
      itemProductUrl: 'https://shop.example/item',
      storeBaseUrl: 'https://shop.example/',
    })).toBe('https://shop.example/item')
    expect(resolveDealStoreUrl({
      dealUrl: null,
      snapshotProductUrl: null,
      itemProductUrl: null,
      storeBaseUrl: 'https://shop.example/',
    })).toBe('https://shop.example/')
    expect(resolveDealStoreUrl({
      dealUrl: 'javascript:alert(1)',
      itemProductUrl: 'https://shop.example/safe',
    })).toBe('https://shop.example/safe')
  })
})

describe('mail', () => {
  it('builds a no-reply alert with public fields only', () => {
    const price = canonicalPrice(1299.9)
    expect(price).toBe('1299.90')
    const key = idempotencyKeyForDeal({
      subscriptionId,
      itemId,
      storeId,
      price: price ?? '',
    })
    const mail = composeDealAlert({
      to: 'ada@example.com',
      productName: '<script>Chair</script>',
      price: 1299.9,
      storeName: 'Costco',
      summary: 'A public summary',
      itemUrl: 'https://harieshwar-ai.github.io/deal-tracker/items/' + itemId,
      storeUrl: 'javascript:alert(1)',
      unsubscribeUrl: 'https://harieshwar-ai.github.io/deal-tracker/unsubscribe?token=abc',
      idempotencyKey: key,
    })
    expect(mail.from).toBe(DEFAULT_ALERTS_FROM)
    expect(mail.replyTo).toBe(DEFAULT_REPLY_TO)
    expect(mail.text).toContain(AUTOMATED_FOOTER)
    expect(mail.html).toContain(AUTOMATED_FOOTER)
    expect(mail.html).toContain('&lt;script&gt;')
    expect(mail.html).not.toContain('<script>')
    expect(mail.text).not.toContain('javascript:')
    expect(mail.text).toContain('A public summary')
    expect(mail.headers['Auto-Submitted']).toBe('auto-generated')
    expect(mail.headers['X-Auto-Response-Suppress']).toBe('All')
    expect(mail.headers['List-Unsubscribe']).toBe('<https://harieshwar-ai.github.io/deal-tracker/unsubscribe?token=abc>')
    expect(mail.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click')
    expect(mail.idempotencyKey).toBe(`deal:${subscriptionId}:${itemId}:${storeId}:1299.90`)
    expect(JSON.stringify(resendPayload(mail))).not.toMatch(/target|membership|notes|reason/i)
    const raw = encodeRfc822(mail)
    expect(raw).toContain(`Reply-To: ${DEFAULT_REPLY_TO}`)
    expect(raw).toContain(AUTOMATED_FOOTER)
    expect(raw).toContain('Auto-Submitted: auto-generated')
  })

  it('uses Resend first and paces batch idempotency keys', async () => {
    expect(chooseMailAdapter({ resendApiKey: 're_test', smtpHost: 'smtp.example', smtpPort: '587', smtpUser: 'a', smtpPass: 'b' })).toBe('resend')
    expect(chooseMailAdapter({ smtpHost: 'smtp.example', smtpPort: '587', smtpUser: 'a', smtpPass: 'b' })).toBe('smtp')
    expect(chooseMailAdapter({})).toBe('none')
    const first = message(`deal:${subscriptionId}:${itemId}:none:10.00`)
    const second = message(`deal:${subscriptionId}:${otherItem}:none:10.00`)
    const batches = planResendBatches([second, first, first])
    expect(batches).toHaveLength(1)
    expect(batches[0]?.map((entry) => entry.idempotencyKey)).toEqual([first.idempotencyKey, second.idempotencyKey])
    expect(await resendIdempotencyHeader([first.idempotencyKey])).toBe(first.idempotencyKey)
    const header = await resendIdempotencyHeader([second.idempotencyKey, first.idempotencyKey])
    expect(header.startsWith('batch:')).toBe(true)
    expect(header).toHaveLength('batch:'.length + 64)
    expect(RESEND_BATCH_SIZE).toBe(100)
    expect(retryDelayMs('2', 0)).toBe(2000)
    expect(retryDelayMs(null, 1)).toBe(2000)
  })

  it('counts subscribers without exposing a second copy of the address list shape', () => {
    const counts = subscriberCounts([
      { id: '1', email: 'a@example.com', itemId: null, category: 'gpu', status: 'confirmed' },
      { id: '2', email: 'b@example.com', itemId, category: null, status: 'pending' },
      { id: '3', email: 'c@example.com', itemId: null, category: 'gpu', status: 'unsubscribed' },
    ])
    expect(counts).toMatchObject({ pending: 1, confirmed: 1, unsubscribed: 1 })
    expect(counts.byCategory).toEqual([{ category: 'gpu', count: 2 }])
    expect(counts.byItem).toEqual([{ itemId, count: 1 }])
  })

  it('drops tokens from a subscribe response', () => {
    expect(parseSubscribeResult({
      ok: true,
      result: 'pending',
      subscription_id: subscriptionId.toUpperCase(),
      confirm_token: 'secret',
      email: 'ada@example.com',
    })).toEqual({ ok: true, result: 'pending', subscriptionId })
    expect(parseTokenResult({
      ok: true,
      result: 'confirmed',
      category: 'gpu',
      item_id: itemId,
      confirm_token: 'secret',
    }, 'confirm')).toEqual({ ok: true, result: 'confirmed', category: 'gpu', itemId })
    expect(categoryLabel('gpu')).toBe('Graphics cards')
    expect(categoryLabel('ram')).toBe('Memory (RAM)')
    expect(categoryLabel('ssd')).toBe('SSDs')
    expect(categoryLabel('prebuilt-pc')).toBe('Prebuilt PCs')
    expect(categoryLabel('chairs')).toBe('Chairs')
    expect(categoryLabel('Chairs')).toBe('Chairs')
    expect(categoryLabel('Prebuilt PCs')).toBe('Prebuilt PCs')
    expect(categoryLabel('Graphics cards')).toBe('Graphics cards')
    expect(categoryLabel('Memory (RAM)')).toBe('Memory (RAM)')
    expect(categoryLabel('SSDs')).toBe('SSDs')
    expect(categoryLabel('PC Hardware')).toBe('PC Hardware')
    expect(categoryLabel('group:pc-hardware')).toBe('All PC hardware')
    expect(categoryLabel('cooling-fans')).toBe('Cooling Fans')
  })
})

describe('alert sql', () => {
  const migration = readFileSync(new URL('../../supabase/migrations/20261025120000_alert_subscriptions.sql', import.meta.url), 'utf8')
  const seed = readFileSync(new URL('../../supabase/seed/alert_subscriptions.sql', import.meta.url), 'utf8')
  const readme = readFileSync(new URL('../../README.md', import.meta.url), 'utf8')

  it('keeps addresses off the public API and matches the rate limits', () => {
    expect(migration).toContain('enable row level security')
    expect(migration).toContain('v_pending_limit integer := 5')
    expect(migration).toContain('v_target_limit integer := 10')
    expect(migration).toContain('subscribe_to_alerts')
    expect(migration).toContain('confirm_alert')
    expect(migration).toContain('unsubscribe_alert')
    expect(migration).toContain('list_alert_subscribers')
    expect(migration).toContain('where category = v_category')
    expect(migration).toContain('and active')
    const listFn = migration.slice(migration.indexOf('function public.list_alert_subscribers'), migration.indexOf('revoke all on function public.list_alert_subscribers'))
    expect(listFn).not.toContain('confirm_token')
    expect(listFn).not.toContain('unsubscribe_token')
    expect(migration).toMatch(/grant execute on function public\.list_alert_subscribers\(\) to authenticated/)
    expect(migration).not.toMatch(/grant execute on function public\.list_alert_subscribers\(\) to anon/)
    expect(migration).toContain('ce399408-8885-49fd-a960-ce4479603aaa')
    expect(migration).not.toMatch(/grant select[^;]*to anon/i)
    const ownerGrant = migration.match(/grant select \([\s\S]*?\) on table public\.alert_subscriptions to authenticated/)
    expect(ownerGrant?.[0]).not.toContain('confirm_token')
    expect(ownerGrant?.[0]).not.toContain('unsubscribe_token')
    expect(PENDING_PER_EMAIL_PER_HOUR).toBe(5)
    expect(TARGET_PER_HOUR).toBe(10)
  })

  it('seeds the owner categories with generated tokens and does not document a mailbox provider by name', () => {
    expect(seed).toContain("'group:pc-hardware'")
    expect(seed.toLowerCase()).toContain('on conflict (email, category) where category is not null do nothing')
    expect(seed).not.toContain("'prebuilt-pc'")
    expect(seed).toContain('harirmdeee@gmail.com')
    expect(seed).toContain('gen_random_uuid')
    expect(seed).not.toMatch(/'[0-9a-f]{32,}'/i)
    expect(alertMatchCategories('Graphics cards')).toEqual(['Graphics cards', 'group:pc-hardware'])
    expect(alertMatchCategories('Chairs')).toEqual(['Chairs'])
    expect(migration).toContain("'group:pc-hardware'")
    expect(migration).toContain("'Memory (RAM)'")
    expect(readme.toLowerCase()).not.toContain('gmail')
    expect(migration.toLowerCase()).not.toContain('gmail')
  })
})
