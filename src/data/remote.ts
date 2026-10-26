import type { DealStatus, Dataset, ItemWrite, StoreWrite } from '../domain/types'
import { supabase } from '../lib/supabase'
import { selectColumns } from './columns'
import { friendlyError, isMissingRelation, isPrivilegeError, isUnusableCredential, missingColumnName, parseDealRow, parseItemRow, parseSnapshotRow, parseStoreRow } from './parse'
import { snapshotsFromRollup } from './rollups'

export type PriceDetail = 'rollup' | 'full'

export interface LoadedCatalog extends Dataset {
  detail: PriceDetail
}

const pageSize = 1000

const rollupColumns = 'id,item_id,store_id,product_title,product_url,price,regular_price,currency,in_stock,captured_at,sale_ends_at,shipping,product_name,meets_requirements'

export async function loadDataset(owner: boolean): Promise<LoadedCatalog> {
  const [items, stores, deals] = await Promise.all([
    fetchAll('items', 'created_at', owner),
    fetchAll('stores', 'name', owner),
    fetchAll('deals', 'found_at', owner),
  ])
  const base = {
    items: items.map((row) => parseItemRow(row)),
    stores: stores.map((row) => parseStoreRow(row)),
    deals: deals.map((row) => parseDealRow(row)),
  }
  try {
    const rolled = await loadRollupRows()
    if (rolled) {
      return {
        ...base,
        snapshots: snapshotsFromRollup(rolled.latest, rolled.daily),
        detail: 'rollup',
      }
    }
  } catch {
    // A view that exists but cannot be read falls through to the snapshot scan.
  }
  const snapshots = await fetchAll('price_snapshots', 'id', owner)
  return {
    ...base,
    snapshots: snapshots.map((row) => parseSnapshotRow(row)),
    detail: 'full',
  }
}

async function loadRollupRows(): Promise<{ latest: unknown[]; daily: unknown[] } | null> {
  const latest = await fetchView('market_latest', rollupColumns, ['item_id', 'store_id', 'id'])
  if (!latest) return null
  const daily = await fetchView('market_daily', 'item_id,store_id,day,qualifying_low', ['item_id', 'store_id', 'day'])
  if (!daily) return null
  return { latest, daily }
}

async function fetchView(table: string, columns: string, order: string[]): Promise<unknown[] | null> {
  const rows: unknown[] = []
  for (let from = 0; ; from += pageSize) {
    let query = supabase.from(table).select(columns)
    for (const column of order) query = query.order(column, { ascending: true })
    const { data, error } = await query.range(from, from + pageSize - 1)
    if (error) {
      if (isMissingRelation(error)) return null
      throw new Error(friendlyError(error))
    }
    const batch = data ?? []
    rows.push(...batch)
    if (batch.length < pageSize) break
  }
  return rows
}

const optionalItemWrites: Record<string, string> = {
  image_url: 'The image address cannot be saved until the latest database migration is applied.',
  specs: 'Public specs cannot be saved until the latest database migration is applied.',
  requirements: 'Requirements cannot be saved until the latest database migration is applied.',
  product_url: 'The product link cannot be saved until the latest database migration is applied.',
  enrichment_status: 'The enrichment status cannot be saved until the latest database migration is applied.',
}

export async function saveItem(write: ItemWrite, id?: string): Promise<void> {
  const payload: Record<string, unknown> = { ...write }
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const query = id
      ? supabase.from('items').update(payload).eq('id', id)
      : supabase.from('items').insert(payload)
    const { error } = await query
    if (!error) return
    const missing = missingColumnName(error)
    const explanation = missing ? optionalItemWrites[missing] : undefined
    if (!missing || !explanation || !(missing in payload)) {
      throw new Error(friendlyError(error))
    }
    if (!blankColumn(payload[missing])) throw new Error(explanation)
    delete payload[missing]
  }
  throw new Error('Could not save the item.')
}

export async function deleteItem(id: string): Promise<void> {
  const { error } = await supabase.from('items').delete().eq('id', id)
  if (error) throw new Error(friendlyError(error))
}

export async function saveStore(write: StoreWrite, id?: string): Promise<void> {
  const query = id
    ? supabase.from('stores').update(write).eq('id', id)
    : supabase.from('stores').insert(write)
  const { error } = await query
  if (error) throw new Error(friendlyError(error))
}

export async function deleteStore(id: string): Promise<void> {
  const { error } = await supabase.from('stores').delete().eq('id', id)
  if (error) throw new Error(friendlyError(error))
}

export async function setDealStatus(id: string, status: DealStatus): Promise<void> {
  const { error } = await supabase.from('deals').update({ status }).eq('id', id)
  if (error) throw new Error(friendlyError(error))
}

function blankColumn(value: unknown): boolean {
  if (value == null || value === '' || value === 'ready') return true
  return Array.isArray(value) && value.length === 0
}

async function fetchAll(
  table: 'items' | 'stores' | 'price_snapshots' | 'deals',
  order: string,
  owner: boolean,
): Promise<unknown[]> {
  const rows: unknown[] = []
  let columns = selectColumns(table, owner)
  let dropped = 0
  let relaxed = false
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .order(order, { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1)
    const missing = error ? missingColumnName(error) : null
    if (missing && dropped < 8 && columns.split(',').includes(missing)) {
      columns = columns.split(',').filter((column) => column !== missing).join(',')
      dropped += 1
      from -= pageSize
      continue
    }
    // A session token PostgREST cannot verify (PGRST301) or a column the
    // anon role cannot read would otherwise paint the raw gateway message.
    // Public columns still load, so the page does not show that banner.
    if (error && owner && !relaxed && (isUnusableCredential(error) || isPrivilegeError(error))) {
      relaxed = true
      columns = selectColumns(table, false)
      from -= pageSize
      continue
    }
    if (error) throw new Error(friendlyError(error))
    const batch = data ?? []
    rows.push(...batch)
    if (batch.length < pageSize) break
  }
  return rows
}
