import type { Dataset, DealStatus, Item, Store } from './types'

export function withItem(data: Dataset, item: Item): Dataset {
  const exists = data.items.some((entry) => entry.id === item.id)
  return {
    ...data,
    items: exists ? data.items.map((entry) => (entry.id === item.id ? item : entry)) : [item, ...data.items],
  }
}

export function withoutItem(data: Dataset, id: string): Dataset {
  return {
    ...data,
    items: data.items.filter((item) => item.id !== id),
    snapshots: data.snapshots.filter((snapshot) => snapshot.item_id !== id),
    deals: data.deals.filter((deal) => deal.item_id !== id),
  }
}

export function withStore(data: Dataset, store: Store): Dataset {
  const exists = data.stores.some((entry) => entry.id === store.id)
  return {
    ...data,
    stores: exists
      ? data.stores.map((entry) => (entry.id === store.id ? store : entry))
      : [...data.stores, store].sort((left, right) => left.name.localeCompare(right.name)),
  }
}

export function withoutStore(data: Dataset, id: string): Dataset {
  return {
    ...data,
    stores: data.stores.filter((store) => store.id !== id),
    snapshots: data.snapshots.map((snapshot) =>
      snapshot.store_id === id ? { ...snapshot, store_id: null } : snapshot,
    ),
    deals: data.deals.map((deal) => (deal.store_id === id ? { ...deal, store_id: null } : deal)),
  }
}

export function withDealStatus(data: Dataset, id: string, status: DealStatus): Dataset {
  return {
    ...data,
    deals: data.deals.map((deal) => (deal.id === id ? { ...deal, status } : deal)),
  }
}
