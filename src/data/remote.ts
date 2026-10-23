import type { DealStatus, Dataset, ItemWrite, StoreWrite } from '../domain/types'
import { supabase } from '../lib/supabase'
import { selectColumns } from './columns'
import { friendlyError, missingColumnName, parseDealRow, parseItemRow, parseSnapshotRow, parseStoreRow } from './parse'

const pageSize = 1000

export async function loadDataset(owner: boolean): Promise<Dataset> {
  const [items, stores, snapshots, deals] = await Promise.all([
    fetchAll('items', 'created_at', owner),
    fetchAll('stores', 'name', owner),
    fetchAll('price_snapshots', 'id', owner),
    fetchAll('deals', 'found_at', owner),
  ])
  return {
    items: items.map((row) => parseItemRow(row)),
    stores: stores.map((row) => parseStoreRow(row)),
    snapshots: snapshots.map((row) => parseSnapshotRow(row)),
    deals: deals.map((row) => parseDealRow(row)),
  }
}

const optionalItemWrites: Record<string, string> = {
  image_url: 'The image address cannot be saved until the latest database migration is applied.',
  specs: 'Public specs cannot be saved until the latest database migration is applied.',
  requirements: 'Requirements cannot be saved until the latest database migration is applied.',
}

export async function saveItem(write: ItemWrite, id?: string): Promise<void> {
  const payload: Record<string, unknown> = { ...write }
  for (let attempt = 0; attempt < 6; attempt += 1) {
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
  if (value == null || value === '') return true
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
    if (error) throw new Error(friendlyError(error))
    const batch = data ?? []
    rows.push(...batch)
    if (batch.length < pageSize) break
  }
  return rows
}
