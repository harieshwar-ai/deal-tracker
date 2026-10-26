// @ts-expect-error TS2591 — node:fs is available when Vitest runs the test.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { visitorHiddenColumns } from './columns'
import { applyOwnerPrivateRow, parseOwnerPrivate } from './ownerPrivate'

describe('owner private catalog', () => {
  const privacyMigration = readFileSync(
    new URL('../../supabase/migrations/20261026180000_authenticated_column_privileges.sql', import.meta.url),
    'utf8',
  )
  const alertMigration = readFileSync(
    new URL('../../supabase/migrations/20261026181000_deal_alert_trigger.sql', import.meta.url),
    'utf8',
  )

  it('merges owner-only fields onto public rows', () => {
    const catalog = parseOwnerPrivate({
      stores: {
        'store-1': { membership: 'Prime', notes: 'Use the business card' },
      },
      items: {},
      deals: {},
      snapshots: {},
    })
    const merged = applyOwnerPrivateRow(
      { id: 'store-1', name: 'Amazon' },
      catalog.stores,
    ) as { membership?: string; notes?: string }
    expect(merged.membership).toBe('Prime')
    expect(merged.notes).toBe('Use the business card')
    expect(applyOwnerPrivateRow({ id: 'other', name: 'Walmart' }, catalog.stores)).toEqual({ id: 'other', name: 'Walmart' })
  })

  it('limits authenticated reads to public columns and exposes owner_catalog_private', () => {
    expect(privacyMigration).toContain('revoke select on table public.stores from authenticated')
    expect(privacyMigration).toContain('grant select (')
    expect(privacyMigration).toContain('owner_catalog_private')
    expect(privacyMigration).toContain('ce399408-8885-49fd-a960-ce4479603aaa')
    expect(privacyMigration).toContain('revoke select on table public.price_snapshots from anon')
    const grantColumns = (privacyMigration.match(/grant select \([\s\S]*?\) on table public\.\w+ to anon, authenticated;/g) ?? [])
      .flatMap((block: string) => block.match(/\n\s+([a-z_]+),?/g)?.map((line: string) => line.trim().replace(/,$/, '')) ?? [])
    for (const hidden of [...visitorHiddenColumns.stores, ...visitorHiddenColumns.items, ...visitorHiddenColumns.deals, 'member_only']) {
      expect(grantColumns).not.toContain(hidden)
    }
  })

  it('invokes deal-alerts from vault secrets with public payloads only', () => {
    expect(alertMigration).toContain('deal_alerts_function_url')
    expect(alertMigration).toContain('deal_alerts_service_role_key')
    expect(alertMigration).toContain('vault.decrypted_secrets')
    expect(alertMigration).toContain('net.http_post')
    expect(alertMigration).toContain("'must_buy', 'good'")
    expect(alertMigration).toContain('deal_alert_dispatches')
    expect(alertMigration).not.toMatch(/'reason'/)
    expect(alertMigration).not.toMatch(/'membership'/)
  })
})
