import type { DealStatus, Dataset, ItemWrite, StoreWrite } from '../domain/types'
import { supabase } from '../lib/supabase'
import { friendlyError, parseDealRow, parseItemRow, parseSnapshotRow, parseStoreRow } from './parse'

const pageSize = 1000

export async function loadDataset(): Promise<Dataset> {
  const [items, stores, snapshots, deals] = await Promise.all([
    fetchAll('items', 'created_at'),
    fetchAll('stores', 'name'),
    fetchAll('price_snapshots', 'id'),
    fetchAll('deals', 'found_at'),
  ])
  return {
    items: items.map((row) => parseItemRow(row)),
    stores: stores.map((row) => parseStoreRow(row)),
    snapshots: snapshots.map((row) => parseSnapshotRow(row)),
    deals: deals.map((row) => parseDealRow(row)),
  }
}

export async function saveItem(write: ItemWrite, id?: string): Promise<void> {
  const query = id
    ? supabase.from('items').update(write).eq('id', id)
    : supabase.from('items').insert(write)
  const { error } = await query
  if (error) throw new Error(friendlyError(error))
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

async function fetchAll(table: 'items' | 'stores' | 'price_snapshots' | 'deals', order: string): Promise<unknown[]> {
  const rows: unknown[] = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order(order, { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1)
    if (error) throw new Error(friendlyError(error))
    const batch = data ?? []
    rows.push(...batch)
    if (batch.length < pageSize) break
  }
  return rows
}
