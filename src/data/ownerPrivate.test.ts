// @ts-expect-error TS2591 — node:fs is available when Vitest runs the test.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { selectColumns, visitorHiddenColumns } from './columns'
import { parseDealRow, parseItemRow, parseStoreRow } from './parse'
import { applyOwnerPrivateRow, parseOwnerPrivate } from './ownerPrivate'

function grantColumnsForTable(migration: string, table: string): string[] {
  const anchor = `) on table public.${table} to anon, authenticated;`
  const end = migration.indexOf(anchor)
  if (end < 0) return []
  const open = migration.lastIndexOf('grant select (', end)
  if (open < 0) return []
  const inner = migration.slice(open + 'grant select ('.length, end)
  return inner
    .split('\n')
    .map((line) => line.trim().replace(/,$/, ''))
    .filter((line) => /^[a-z_]+$/.test(line))
}

describe('owner private catalog', () => {
  const privacyMigration = readFileSync(
    new URL('../../supabase/migrations/20261027000300_authenticated_column_privileges.sql', import.meta.url),
    'utf8',
  )
  const alertMigration = readFileSync(
    new URL('../../supabase/migrations/20261027000400_deal_alert_trigger.sql', import.meta.url),
    'utf8',
  )
  const dropLatestStorePricesMigration = readFileSync(
    new URL('../../supabase/migrations/20261027000500_drop_latest_store_prices.sql', import.meta.url),
    'utf8',
  )

  it('merges owner-only fields onto public rows for edit views', () => {
    const catalog = parseOwnerPrivate({
      stores: {
        'store-1': { membership: 'Prime', notes: 'Use the business card' },
      },
      items: {
        'item-1': {
          description: 'Internal blurb',
          notes: 'Watch for sales',
          target_price: 199.99,
          max_price: 249.99,
          requirements: [{ label: 'Ergonomic' }],
        },
      },
      deals: {
        'deal-1': { reason: 'Under target with wide margin.' },
      },
      snapshots: {},
    })
    const store = parseStoreRow(applyOwnerPrivateRow(
      { id: 'store-1', name: 'Amazon', base_url: null, country: 'CA', country_code: 'CA', enabled: true, created_at: '2026-10-22T16:00:00.000Z', updated_at: '2026-10-22T16:00:00.000Z' },
      catalog.stores,
    ))
    expect(store.membership).toBe('Prime')
    expect(store.notes).toBe('Use the business card')

    const item = parseItemRow(applyOwnerPrivateRow(
      {
        id: 'item-1',
        name: 'Chair',
        public_summary: 'Public copy',
        category: 'Chairs',
        keywords: [],
        condition: 'new',
        priority: 'normal',
        active: true,
        image_url: null,
        specs: [],
        product_url: null,
        enrichment_status: 'ready',
        created_at: '2026-10-22T16:00:00.000Z',
        updated_at: '2026-10-22T16:00:00.000Z',
      },
      catalog.items,
    ))
    expect(item.description).toBe('Internal blurb')
    expect(item.notes).toBe('Watch for sales')
    expect(item.target_price).toBe(199.99)
    expect(item.max_price).toBe(249.99)
    expect(item.requirements).toEqual([{ label: 'Ergonomic' }])

    const deal = parseDealRow(applyOwnerPrivateRow(
      {
        id: 'deal-1',
        item_id: 'item-1',
        store_id: 'store-1',
        snapshot_id: null,
        title: 'Chair',
        url: null,
        price: 195.89,
        regular_price: null,
        discount_pct: null,
        score: 10,
        verdict: 'good',
        notified_at: null,
        expires_at: null,
        status: 'open',
        found_at: '2026-10-22T16:00:00.000Z',
      },
      catalog.deals,
    ))
    expect(deal.reason).toBe('Under target with wide margin.')

    expect(applyOwnerPrivateRow({ id: 'other', name: 'Walmart' }, catalog.stores)).toEqual({ id: 'other', name: 'Walmart' })
  })

  it('limits authenticated reads to the current public column grants', () => {
    expect(privacyMigration).toContain('revoke select on table public.stores from authenticated')
    expect(privacyMigration).toContain('owner_catalog_private')
    expect(privacyMigration).toContain('ce399408-8885-49fd-a960-ce4479603aaa')
    expect(privacyMigration).toContain('revoke select on table public.price_snapshots from anon')

    const tables = ['items', 'stores', 'deals', 'price_snapshots'] as const
    for (const table of tables) {
      const granted = grantColumnsForTable(privacyMigration, table)
      const expected = selectColumns(table, false).split(',')
      expect(granted.sort()).toEqual(expected.sort())
    }
    expect(grantColumnsForTable(privacyMigration, 'stores')).toContain('country_code')

    const grantColumns = tables.flatMap((table) => grantColumnsForTable(privacyMigration, table))
    for (const hidden of [...visitorHiddenColumns.stores, ...visitorHiddenColumns.items, ...visitorHiddenColumns.deals, 'member_only']) {
      expect(grantColumns).not.toContain(hidden)
    }
  })

  it('drops latest_store_prices and keeps owner_catalog_private off anon', () => {
    expect(dropLatestStorePricesMigration).toContain('drop view if exists public.latest_store_prices')
    expect(dropLatestStorePricesMigration).toContain('revoke execute on function public.owner_catalog_private() from public')
    expect(dropLatestStorePricesMigration).toContain('revoke execute on function public.owner_catalog_private() from anon')
    expect(dropLatestStorePricesMigration).toMatch(/grant execute on function public\.owner_catalog_private\(\) to authenticated/)
    expect(dropLatestStorePricesMigration.toLowerCase()).not.toContain('cascade')
  })

  it('invokes deal-alerts from vault secrets with public payloads only', () => {
    expect(alertMigration).toContain('deal_alerts_function_url')
    expect(alertMigration).toContain('deal_alerts_service_role_key')
    expect(alertMigration).toContain('vault.decrypted_secrets')
    expect(alertMigration).toContain('net.http_post')
    expect(alertMigration).toContain("'must_buy', 'good'")
    expect(alertMigration).toContain('deal_alert_dispatches')
    expect(alertMigration.indexOf('net.http_post')).toBeLessThan(alertMigration.indexOf('insert into public.deal_alert_dispatches'))
    expect(alertMigration).not.toMatch(/'reason'/)
    expect(alertMigration).not.toMatch(/'membership'/)
  })
})
