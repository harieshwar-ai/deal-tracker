export interface OwnerPrivateCatalog {
  stores: Record<string, { membership?: string | null; notes?: string | null }>
  items: Record<string, {
    description?: string | null
    notes?: string | null
    target_price?: number | string | null
    max_price?: number | string | null
    requirements?: unknown
  }>
  deals: Record<string, { reason?: string | null }>
  snapshots: Record<string, { member_only?: boolean | null }>
}

export function emptyOwnerPrivate(): OwnerPrivateCatalog {
  return { stores: {}, items: {}, deals: {}, snapshots: {} }
}

export function parseOwnerPrivate(data: unknown): OwnerPrivateCatalog {
  if (!data || typeof data !== 'object') return emptyOwnerPrivate()
  const record = data as Record<string, unknown>
  return {
    stores: bucket(record.stores),
    items: bucket(record.items),
    deals: bucket(record.deals),
    snapshots: bucket(record.snapshots),
  }
}

export function applyOwnerPrivateRow(
  row: unknown,
  extras: Record<string, Record<string, unknown>> | undefined,
): unknown {
  if (!extras || typeof row !== 'object' || row == null || !('id' in row)) return row
  const id = String((row as { id: unknown }).id)
  const patch = extras[id]
  if (!patch) return row
  return { ...row, ...patch }
}

function bucket(value: unknown): Record<string, Record<string, unknown>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, Record<string, unknown>>
}
