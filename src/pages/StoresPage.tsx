import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useCanEdit } from '../auth/AuthProvider'
import { StoreForm } from '../components/StoreForm'
import { useToast } from '../components/toast'
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
      {stores.length === 0 ? (
        <div className="mt-8">
          <EmptyState title="No stores on the list" body="Add a Canadian store before asking the checker to look for prices." />
        </div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {stores.map((store) => {
            const href = safeHttpUrl(store.base_url)
            return (
              <article key={store.id} className="rounded-3xl border border-line bg-paper-2 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-3xl">{store.name}</h2>
                    <p className="mt-1 text-sm text-muted">
                      {[store.country ?? 'CA', store.membership].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <Badge className={store.enabled ? 'bg-pine-soft text-pine' : 'bg-paper text-muted'}>
                    {store.enabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
                {href ? <a className="mt-3 inline-block text-sm text-pine underline" href={href} target="_blank" rel="noopener noreferrer">{href.replace(/^https?:\/\//, '')}</a> : null}
                {store.notes ? <p className="mt-3 text-sm leading-6">{store.notes}</p> : null}
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
              </article>
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
