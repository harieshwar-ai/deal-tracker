import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { isOwnerSession } from '../auth/owner'
import { withDealStatus, withItem, withoutItem, withStore, withoutStore } from '../domain/mutate'
import type { Dataset, DealStatus, Item, ItemWrite, Store, StoreWrite } from '../domain/types'
import { deleteItem as removeItem, deleteStore as removeStore, loadDataset, saveItem as persistItem, saveStore as persistStore, setDealStatus as persistDealStatus } from '../data/remote'
import { createPreviewDataset } from '../preview/fixtures'

export interface CatalogValue {
  items: Item[]
  stores: Store[]
  snapshots: Dataset['snapshots']
  deals: Dataset['deals']
  ready: boolean
  refreshing: boolean
  error: string | null
  source: 'remote' | 'preview'
  refresh: () => Promise<void>
  saveItem: (write: ItemWrite, id?: string) => Promise<void>
  deleteItem: (id: string) => Promise<void>
  saveStore: (write: StoreWrite, id?: string) => Promise<void>
  deleteStore: (id: string) => Promise<void>
  setDealStatus: (id: string, status: DealStatus) => Promise<void>
}

const CatalogContext = createContext<CatalogValue | null>(null)
const empty: Dataset = { items: [], stores: [], snapshots: [], deals: [] }

export function useCatalog(): CatalogValue {
  const value = useContext(CatalogContext)
  if (!value) throw new Error('useCatalog must be used inside a catalog provider.')
  return value
}

export function RemoteCatalogProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const owner = isOwnerSession(session?.user.id)
  const [data, setData] = useState<Dataset>(empty)
  const [ready, setReady] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setRefreshing(true)
    setError(null)
    try {
      setData(await loadDataset(owner))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your data.')
    } finally {
      setRefreshing(false)
      setReady(true)
    }
  }, [owner])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    let hiddenAt = 0
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') hiddenAt = Date.now()
      if (document.visibilityState === 'visible' && hiddenAt && Date.now() - hiddenAt > 60_000) void refresh()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [refresh])

  const api = useMemo<CatalogValue>(() => ({
    ...data,
    ready,
    refreshing,
    error,
    source: 'remote',
    refresh,
    saveItem: async (write, id) => {
      await persistItem(write, id)
      await refresh()
    },
    deleteItem: async (id) => {
      await removeItem(id)
      await refresh()
    },
    saveStore: async (write, id) => {
      await persistStore(write, id)
      await refresh()
    },
    deleteStore: async (id) => {
      await removeStore(id)
      await refresh()
    },
    setDealStatus: async (id, status) => {
      await persistDealStatus(id, status)
      await refresh()
    },
  }), [data, ready, refreshing, error, refresh])

  return <CatalogContext.Provider value={api}>{children}</CatalogContext.Provider>
}

export function PreviewCatalogProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Dataset>(() => createPreviewDataset())

  const refresh = useCallback(async () => {
    setData(createPreviewDataset())
  }, [])

  const api = useMemo<CatalogValue>(() => ({
    ...data,
    ready: true,
    refreshing: false,
    error: null,
    source: 'preview',
    refresh,
    saveItem: async (write, id) => {
      const nowIso = new Date().toISOString()
      setData((current) => {
        const existing = id ? current.items.find((item) => item.id === id) : undefined
        const item: Item = {
          id: id ?? crypto.randomUUID(),
          name: write.name,
          public_summary: write.public_summary,
          description: write.description,
          category: write.category,
          keywords: write.keywords,
          target_price: write.target_price,
          max_price: write.max_price,
          priority: write.priority,
          condition: write.condition,
          notes: write.notes,
          active: write.active,
          created_at: existing?.created_at ?? nowIso,
          updated_at: nowIso,
        }
        return withItem(current, item)
      })
    },
    deleteItem: async (id) => {
      setData((current) => withoutItem(current, id))
    },
    saveStore: async (write, id) => {
      const duplicate = data.stores.some(
        (store) => store.name.toLowerCase() === write.name.toLowerCase() && store.id !== id,
      )
      if (duplicate) throw new Error('A record with that name already exists.')
      const nowIso = new Date().toISOString()
      setData((current) => {
        const existing = id ? current.stores.find((store) => store.id === id) : undefined
        const store: Store = {
          id: id ?? crypto.randomUUID(),
          name: write.name,
          base_url: write.base_url,
          country: write.country,
          membership: write.membership,
          notes: write.notes,
          enabled: write.enabled,
          created_at: existing?.created_at ?? nowIso,
          updated_at: nowIso,
        }
        return withStore(current, store)
      })
    },
    deleteStore: async (id) => {
      setData((current) => withoutStore(current, id))
    },
    setDealStatus: async (id, status) => {
      setData((current) => withDealStatus(current, id, status))
    },
  }), [data, refresh])

  return <CatalogContext.Provider value={api}>{children}</CatalogContext.Provider>
}
