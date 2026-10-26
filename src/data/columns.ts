const publicItemColumns = [
  'id',
  'name',
  'public_summary',
  'category',
  'keywords',
  'condition',
  'priority',
  'active',
  'image_url',
  'specs',
  'product_url',
  'enrichment_status',
  'created_at',
  'updated_at',
] as const

const ownerItemColumns = [
  ...publicItemColumns,
  'description',
  'notes',
  'target_price',
  'max_price',
  'requirements',
] as const

const publicStoreColumns = [
  'id',
  'name',
  'base_url',
  'country',
  'country_code',
  'enabled',
  'created_at',
  'updated_at',
] as const

const ownerStoreColumns = [...publicStoreColumns, 'membership', 'notes'] as const

const publicDealColumns = [
  'id',
  'item_id',
  'store_id',
  'snapshot_id',
  'title',
  'url',
  'price',
  'regular_price',
  'discount_pct',
  'score',
  'verdict',
  'notified_at',
  'expires_at',
  'status',
  'found_at',
] as const

const ownerDealColumns = [...publicDealColumns, 'reason'] as const

const publicSnapshotColumns = [
  'id',
  'item_id',
  'store_id',
  'product_title',
  'product_url',
  'price',
  'regular_price',
  'currency',
  'in_stock',
  'captured_at',
  'sale_ends_at',
  'shipping',
  'product_name',
  'meets_requirements',
] as const

const ownerSnapshotColumns = [...publicSnapshotColumns, 'member_only'] as const

export const visitorHiddenColumns = {
  items: ['description', 'notes', 'target_price', 'max_price', 'requirements'],
  stores: ['membership', 'notes'],
  deals: ['reason'],
} as const

export function selectColumns(table: 'items' | 'stores' | 'deals' | 'price_snapshots', owner: boolean): string {
  switch (table) {
    case 'items':
      return list(owner ? ownerItemColumns : publicItemColumns)
    case 'stores':
      return list(owner ? ownerStoreColumns : publicStoreColumns)
    case 'deals':
      return list(owner ? ownerDealColumns : publicDealColumns)
    case 'price_snapshots':
      return list(owner ? ownerSnapshotColumns : publicSnapshotColumns)
    default: {
      const neverTable: never = table
      return neverTable
    }
  }
}

function list(columns: readonly string[]): string {
  return columns.join(',')
}
