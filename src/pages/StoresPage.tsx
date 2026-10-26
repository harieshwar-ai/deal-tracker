import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { FadeIn, MotionCard } from '../components/motion'
import { useCanEdit } from '../auth/AuthProvider'
import { StoreForm } from '../components/StoreForm'
import { useToast } from '../components/toast'
import { CoverageChart } from '../components/charts'
import { RelativeTime } from '../components/RelativeTime'
import { Badge, buttonClass, ConfirmDialog, EmptyState, ErrorState, LoadingBlock, Modal } from '../components/ui'
import { blankStoreDraft, storeToDraft } from '../domain/drafts'
import { safeHttpUrl } from '../domain/format'
import type { Store, StoreWrite } from '../domain/types'
import { useDocumentTitle } from '../lib/title'
import { useCatalog } from '../state/catalog'

export function StoresPage() {
  useDocumentTitle('Stores')
  const catalog = useCatalog()
  const canEdit = useCanEdit()
  const push = useToast()
  const [editing, setEditing] = useState<Store | 'new' | null>(null)
  const [removing, setRemoving] = useState<Store | null>(null)
  const [pendingDelete, setPendingDelete] = useState(false)
  const stores = [...catalog.stores].sort((left, right) => Number(right.enabled) - Number(left.enabled) || left.name.localeCompare(right.name))
  const coverage = stores.map((store) => {
    const rows = catalog.snapshots.filter((snapshot) => snapshot.store_id === store.id && snapshot.id >= 0)
    let last = ''
    for (const row of rows) {
      if (row.captured_at > last) last = row.captured_at
    }
    return {
      store,
      items: new Set(rows.map((row) => row.item_id)).size,
      prices: rows.length,
      last: last || null,
    }
  })
  const tracked = coverage.reduce((sum, row) => sum + row.prices, 0)
  const freshest = [...coverage].filter((row) => row.last).sort((left, right) => (right.last ?? '').localeCompare(left.last ?? ''))[0]
  const widest = [...coverage].sort((left, right) => right.items - left.items || left.store.name.localeCompare(right.store.name))[0]

  async function save(write: StoreWrite, id?: string) {
    await catalog.saveStore(write, id)
    push('ok', id ? 'Store saved.' : 'Store added.')
    setEditing(null)
  }

  if (!catalog.ready) return <LoadingBlock />
  if (catalog.error && catalog.stores.length === 0) {
    return <ErrorState message={catalog.error} onRetry={() => void catalog.refresh()} />
  }

  return (
    <FadeIn>
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl">Stores</h1>
          <p className="mt-1 max-w-xl text-sm leading-6 text-muted">
            The price checker should only visit enabled stores. Disabling one keeps its history. Deleting one keeps the snapshots, but they will no longer name the store.
          </p>
        </div>
        {canEdit ? (
          <button type="button" className={buttonClass()} onClick={() => setEditing('new')}>
            <Plus className="h-4 w-4" />
            Add store
          </button>
        ) : null}
      </div>
      <section className="mt-6 grid gap-3 sm:grid-cols-3" aria-label="Store summary">
        <article className="rounded-xl border border-line bg-paper-2 p-4 shadow-sm">
          <p className="text-sm text-muted">Stores enabled</p>
          <p className="mt-2 font-mono text-2xl tabular-nums">{stores.filter((store) => store.enabled).length}</p>
          <p className="mt-1 text-sm text-muted">{stores.length} on the list</p>
        </article>
        <article className="rounded-xl border border-line bg-paper-2 p-4 shadow-sm">
          <p className="text-sm text-muted">Prices tracked</p>
          <p className="mt-2 font-mono text-2xl tabular-nums">{tracked}</p>
          <p className="mt-1 text-sm text-muted">{catalog.detail === 'rollup' ? 'Latest offer per listing' : 'Saved checks'}</p>
        </article>
        <article className="rounded-xl border border-line bg-paper-2 p-4 shadow-sm">
          <p className="text-sm text-muted">Freshest check</p>
          <p className="mt-2 text-lg font-medium">{freshest ? freshest.store.name : '—'}</p>
          <p className="mt-1 text-sm text-muted">{freshest?.last ? <RelativeTime iso={freshest.last} /> : 'No check saved yet'}</p>
        </article>
      </section>
      {widest && widest.items > 0 ? (
        <section className="mt-4 rounded-xl border border-line bg-paper-2 p-4 shadow-sm md:p-5">
          <h2 className="font-display text-2xl">Coverage</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted">
            {widest.store.name} covers the most items ({widest.items}).
            {freshest && freshest.store.id !== widest.store.id ? ` ${freshest.store.name} has the newest check.` : ' That store also has the newest check.'}
            {' '}A disabled store keeps its history and is left out of the next scan.
          </p>
          <div className="mt-4">
            <CoverageChart rows={coverage.map((row) => ({ name: row.store.name, items: row.items }))} />
          </div>
        </section>
      ) : null}
      {stores.length === 0 ? (
        <div className="mt-8">
          <EmptyState title="No stores on the list" body="Add a Canadian store before asking the checker to look for prices." />
        </div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {stores.map((store, index) => {
            const href = safeHttpUrl(store.base_url)
            return (
              <MotionCard key={store.id} index={index} className="rounded-xl border border-line bg-paper-2 p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-3xl">{store.name}</h2>
                    <p className="mt-1 text-sm text-muted">
                      {[store.country ?? 'CA', canEdit ? store.membership : null].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <Badge className={store.enabled ? 'bg-pine-soft text-pine' : 'bg-paper text-muted'}>
                    {store.enabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
                {href ? <a className="mt-3 inline-block text-sm text-pine underline" href={href} target="_blank" rel="noopener noreferrer">{href.replace(/^https?:\/\//, '')}</a> : null}
                {canEdit && store.notes ? <p className="mt-3 text-sm leading-6">{store.notes}</p> : null}
                {canEdit ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button type="button" className={buttonClass('secondary', 'sm')} onClick={() => void save(storeWrite(store, !store.enabled), store.id)}>
                      {store.enabled ? 'Disable' : 'Enable'}
                    </button>
                    <button type="button" className={buttonClass('ghost', 'sm')} onClick={() => setEditing(store)} aria-label={`Edit ${store.name}`}>
                      <Pencil className="h-4 w-4" />
                      Edit
                    </button>
                    <button type="button" className={buttonClass('ghost', 'sm')} onClick={() => setRemoving(store)} aria-label={`Delete ${store.name}`}>
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </button>
                  </div>
                ) : null}
              </MotionCard>
            )
          })}
        </div>
      )}
      <Modal open={editing != null} title={editing === 'new' ? 'New store' : 'Edit store'} onClose={() => setEditing(null)}>
        {editing != null ? (
          <StoreForm
            key={editing === 'new' ? 'new' : editing.id}
            initial={editing === 'new' ? blankStoreDraft() : storeToDraft(editing)}
            submitLabel={editing === 'new' ? 'Add store' : 'Save changes'}
            onCancel={() => setEditing(null)}
            onSubmit={(write) => save(write, editing === 'new' ? undefined : editing.id)}
          />
        ) : null}
      </Modal>
      <ConfirmDialog
        open={removing != null}
        title={removing ? `Delete ${removing.name}?` : 'Delete store?'}
        body="Price snapshots and deals stay, but they will no longer name this store."
        confirmLabel={pendingDelete ? 'Deleting…' : 'Delete store'}
        pending={pendingDelete}
        onClose={() => setRemoving(null)}
        onConfirm={() => {
          if (!removing) return
          setPendingDelete(true)
          void catalog.deleteStore(removing.id).then(() => {
            push('ok', 'Store deleted.')
            setRemoving(null)
          }).catch((error: unknown) => {
            push('error', error instanceof Error ? error.message : 'Could not delete the store.')
          }).finally(() => setPendingDelete(false))
        }}
      />
    </div>
    </FadeIn>
  )
}

function storeWrite(store: Store, enabled: boolean): StoreWrite {
  return {
    name: store.name,
    base_url: store.base_url,
    country: store.country ?? 'CA',
    membership: store.membership,
    notes: store.notes,
    enabled,
  }
}
