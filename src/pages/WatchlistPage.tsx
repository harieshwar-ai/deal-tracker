import { createColumnHelper } from '@tanstack/react-table'
import type { ColumnDef, SortingState } from '@tanstack/react-table'
import { Pencil, Plus, Rows3, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useCanEdit } from '../auth/AuthProvider'
import { useAlertSignup } from '../components/AlertSignup'
import { ItemForm } from '../components/ItemForm'
import { MarketTable } from '../components/MarketTable'
import { SeasonCards } from '../components/SeasonCards'
import { RelativeTime } from '../components/RelativeTime'
import { TimelineList } from '../components/Timeline'
import { useToast } from '../components/toast'
import { FadeIn } from '../components/motion'
import { Badge, buttonClass, ConfirmDialog, controlClass, EmptyState, ErrorState, LoadingBlock, Modal, Segmented, Select } from '../components/ui'
import { blankItemDraft, itemToDraft, pendingItemFromUrl } from '../domain/drafts'
import { parseActivity, parsePriorityFilter } from '../domain/filters'
import { formatCad, safeHttpUrl } from '../domain/format'
import { categoryLabel, priorityLabel, priorityTone } from '../domain/labels'
import { marketOverview, versusTypical } from '../domain/overview'
import type { Item } from '../domain/types'
import type { PriceBrief } from '../domain/context'
import { priceBrief } from '../domain/context'
import { priceCallLabel, priceCallTone, priceCallsForDataset } from '../domain/verdict'
import type { PriceCallResult } from '../domain/verdict'
import { buildWatchRows, filterWatchRows, watchCategories } from '../domain/watchlist'
import type { WatchRow } from '../domain/watchlist'
import { writeParams } from '../lib/search'
import { useDocumentTitle } from '../lib/title'
import { useCatalog } from '../state/catalog'

interface Listed {
  row: WatchRow
  call: PriceCallResult | null
  brief: PriceBrief | null
}

const columnHelper = createColumnHelper<Listed>()
const pageSize = 20

export function WatchlistPage() {
  useDocumentTitle('Watchlist')
  const catalog = useCatalog()
  const canEdit = useCanEdit()
  const push = useToast()
  const openAlerts = useAlertSignup()
  const [params, setParams] = useSearchParams()
  const [editing, setEditing] = useState<Item | null | 'new'>(null)
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkValue, setLinkValue] = useState('')
  const [linkError, setLinkError] = useState<string | null>(null)
  const [linkPending, setLinkPending] = useState(false)
  const [removing, setRemoving] = useState<Item | null>(null)
  const [pendingDelete, setPendingDelete] = useState(false)

  const query = params.get('q') ?? ''
  const category = params.get('category')
  const priority = parsePriorityFilter(params.get('priority'))
  const activity = parseActivity(params.get('activity'))
  const storeId = params.get('store')
  const stock = params.get('stock')
  const fit = params.get('fit')
  const verdict = params.get('verdict')
  const density = params.get('density') === 'compact' ? 'compact' : 'comfortable'
  const page = positiveInt(params.get('page'))
  const sorting = useMemo<SortingState>(() => [{
    id: params.get('col') || 'call',
    desc: params.get('dir') === 'desc',
  }], [params])

  const overview = useMemo(
    () => marketOverview(catalog, canEdit),
    [catalog, canEdit],
  )
  const calls = useMemo(() => priceCallsForDataset(catalog, canEdit), [catalog, canEdit])
  const briefs = useMemo(() => {
    const byItem = new Map<string, PriceBrief>()
    for (const item of catalog.items) {
      byItem.set(item.id, priceBrief(catalog.snapshots.filter((snapshot) => snapshot.item_id === item.id), catalog.stores))
    }
    return byItem
  }, [catalog.items, catalog.snapshots, catalog.stores])
  const categories = watchCategories(catalog.items)
  const rows = useMemo(() => {
    const built = buildWatchRows(catalog)
    const filtered = filterWatchRows(built, { query, category, priority, activity, sort: 'name' }, canEdit)
    const listed: Listed[] = filtered.map((row) => ({
      row,
      call: calls.get(row.item.id) ?? null,
      brief: briefs.get(row.item.id) ?? null,
    }))
    return listed.filter((entry) => facetMatch(entry, { storeId, stock, fit, verdict }))
  }, [activity, briefs, calls, canEdit, catalog, category, fit, priority, query, stock, storeId, verdict])

  const columns = useMemo(() => watchColumns({
    canEdit,
    onEdit: setEditing,
    onDelete: setRemoving,
  }), [canEdit])

  function update(updates: Record<string, string | null>, keepPage = false) {
    setParams(writeParams(params, keepPage ? updates : { ...updates, page: null }), { replace: true })
  }

  if (!catalog.ready) return <LoadingBlock />
  if (catalog.error && catalog.items.length === 0 && catalog.stores.length === 0) {
    return <ErrorState message={catalog.error} onRetry={() => void catalog.refresh()} />
  }

  const stores = [...catalog.stores].sort((left, right) => left.name.localeCompare(right.name))

  return (
    <FadeIn>
      <div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium tracking-wide text-muted uppercase">Market</p>
            <h1 className="font-display text-4xl">Watchlist</h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
              {overview.watched} active items. Best current price, then the rest of the book.
            </p>
          </div>
          {canEdit ? (
            <div className="flex flex-wrap gap-2">
              <button type="button" className={buttonClass('secondary')} onClick={() => { setLinkValue(''); setLinkError(null); setLinkOpen(true) }}>
                Add from link
              </button>
              <button type="button" className={buttonClass()} onClick={() => setEditing('new')}>
                <Plus className="h-4 w-4" />
                Add item
              </button>
            </div>
          ) : null}
        </div>

        <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Market summary">
          <Kpi label="Items watched" value={String(overview.watched)} detail="Active items on the list" />
          <Kpi label="Open good deals" value={String(overview.openGoodDeals)} detail="Must buy and good, still open" />
          <Kpi
            label="Biggest drop this week"
            value={overview.biggestDrop ? formatCad(overview.biggestDrop.amount) : '—'}
            detail={overview.biggestDrop ? `${overview.biggestDrop.itemName} · ${overview.biggestDrop.storeName}` : 'No drop saved in the last 7 days'}
          />
          <Kpi label="Last scan" value={overview.lastScan ? '' : '—'} detail={overview.lastScan ? '' : 'No check saved yet'}>
            {overview.lastScan ? <RelativeTime iso={overview.lastScan} /> : null}
          </Kpi>
        </section>

        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(16rem,0.8fr)]">
          <section className="rounded-xl border border-line bg-paper-2 p-4 shadow-sm md:p-5">
            <h2 className="font-display text-2xl">Best deals right now</h2>
            {overview.bestDeals.length === 0 ? (
              <p className="mt-3 text-sm text-muted">Nothing is a buy or a good price right now.</p>
            ) : (
              <ol className="mt-3 grid gap-2">
                {overview.bestDeals.map((deal, index) => (
                  <li key={deal.itemId} className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg bg-paper px-3 py-2">
                    <p className="min-w-0 text-sm">
                      <span className="mr-2 font-mono text-muted">{index + 1}</span>
                      <Link className="font-medium hover:text-pine" to={`/items/${deal.itemId}`}>{deal.name}</Link>
                      <span className="text-muted"> · {deal.storeName}</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <Badge className={priceCallTone(deal.call)}>{priceCallLabel(deal.call)}</Badge>
                      <span className="font-mono tabular-nums">{formatCad(deal.price)}</span>
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </section>
          <section>
            <h2 className="font-display text-2xl">Categories</h2>
            {overview.categories.length === 0 ? (
              <p className="mt-3 text-sm text-muted">No categories yet.</p>
            ) : (
              <ul className="mt-3 grid grid-cols-2 gap-2">
                {overview.categories.map((tile) => (
                  <li key={tile.category}>
                    <button
                      type="button"
                      className="h-full w-full rounded-xl border border-line bg-paper-2 p-3 text-left shadow-sm hover:border-pine/40"
                      onClick={() => update({ category: category === tile.category ? null : tile.category })}
                    >
                      <span className="block text-sm font-medium">{tile.label}</span>
                      <span className="mt-1 block text-xs text-muted">{tile.items} watched · {tile.goodDeals} good</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <section id="prices" className="mt-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl">Prices</h2>
              <p className="mt-1 text-sm text-muted">One row per product. Qualifying in-stock offers set the best price.</p>
            </div>
            <button
              type="button"
              className={buttonClass('secondary', 'sm')}
              aria-pressed={density === 'compact'}
              onClick={() => update({ density: density === 'compact' ? null : 'compact' }, true)}
            >
              <Rows3 className="h-4 w-4" />
              {density === 'compact' ? 'Comfortable' : 'Compact'}
            </button>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            <input
              className={controlClass}
              value={query}
              onChange={(event) => update({ q: event.target.value || null })}
              placeholder={canEdit ? 'Search name, notes, keywords' : 'Search name, category, keywords'}
              aria-label="Search items"
            />
            <Select
              label="Category"
              value={category ?? 'all'}
              onValueChange={(value) => update({ category: value === 'all' ? null : value })}
              options={[{ value: 'all', label: 'All categories' }, ...categories.map((entry) => ({ value: entry, label: categoryLabel(entry) }))]}
            />
            <Select
              label="Store"
              value={storeId ?? 'all'}
              onValueChange={(value) => update({ store: value === 'all' ? null : value })}
              options={[{ value: 'all', label: 'All stores' }, ...stores.map((store) => ({ value: store.id, label: store.name }))]}
            />
            <Select
              label="Stock"
              value={stock ?? 'all'}
              onValueChange={(value) => update({ stock: value === 'all' ? null : value })}
              options={[{ value: 'all', label: 'Any stock' }, { value: 'in', label: 'In stock' }, { value: 'out', label: 'Out of stock' }]}
            />
            <Select
              label="Meets requirements"
              value={fit ?? 'all'}
              onValueChange={(value) => update({ fit: value === 'all' ? null : value })}
              options={[{ value: 'all', label: 'Any fit' }, { value: 'yes', label: 'Meets specs' }, { value: 'no', label: 'No qualifying offer' }]}
            />
            <Select
              label="Priority"
              value={priority}
              onValueChange={(value) => update({ priority: value === 'all' ? null : value })}
              options={[
                { value: 'all', label: 'All priorities' },
                { value: 'high', label: 'High' },
                { value: 'normal', label: 'Normal' },
                { value: 'low', label: 'Low' },
              ]}
            />
            <Select
              label="Verdict"
              value={verdict ?? 'all'}
              onValueChange={(value) => update({ verdict: value === 'all' ? null : value })}
              options={[
                { value: 'all', label: 'Any verdict' },
                { value: 'buy', label: 'Buy now' },
                { value: 'good', label: 'Good price' },
                { value: 'wait', label: 'Wait' },
              ]}
            />
          </div>
          {category ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-paper-2 px-4 py-3">
              <p className="text-sm">Public price alerts for <span className="font-medium">{categoryLabel(category)}</span>.</p>
              <button type="button" className={buttonClass('secondary', 'sm')} onClick={() => openAlerts({ category })}>
                Get alerts for {categoryLabel(category)}
              </button>
            </div>
          ) : null}
          <div className="mt-3">
            <Segmented
              label="Activity"
              value={activity}
              onChange={(next) => update({ activity: next === 'active' ? null : next })}
              options={[
                { value: 'active', label: 'Active' },
                { value: 'paused', label: 'Paused' },
                { value: 'all', label: 'All' },
              ]}
            />
          </div>
          <div className="mt-4">
            {catalog.items.length === 0 ? (
              <EmptyState
                title="Nothing to watch yet"
                body={canEdit
                  ? 'Add the things you actually want to buy. The daily check will attach prices from the stores you keep enabled.'
                  : 'The watchlist is empty right now. Prices show up here after the owner adds an item.'}
                action={canEdit ? <button type="button" className={buttonClass()} onClick={() => setEditing('new')}>Add the first item</button> : undefined}
              />
            ) : (
              <MarketTable
                data={rows}
                columns={columns}
                getRowId={(entry) => entry.row.item.id}
                sorting={sorting}
                onSortingChange={(next) => {
                  const first = next[0]
                  update({
                    col: !first || (first.id === 'call' && !first.desc) ? null : first.id,
                    dir: first?.desc ? 'desc' : null,
                  })
                }}
                page={page}
                pageSize={pageSize}
                onPageChange={(next) => update({ page: next <= 1 ? null : String(next) }, true)}
                density={density}
                caption="Watchlist prices"
                empty={<EmptyState title="No items match" body="Clear a filter or try a different search." />}
                renderCard={(entry) => (
                  <WatchCard
                    entry={entry}
                    canEdit={canEdit}
                    onAlert={() => openAlerts({ itemId: entry.row.item.id, itemName: entry.row.item.name, category: entry.row.item.category })}
                    onEdit={() => setEditing(entry.row.item)}
                    onDelete={() => setRemoving(entry.row.item)}
                  />
                )}
              />
            )}
          </div>
        </section>

        <section className="mt-8">
          <h2 className="font-display text-2xl">Recent price changes</h2>
          <p className="mt-1 text-sm text-muted">Latest move for each product variant. Older checks stay on the item chart.</p>
          <div className="mt-3">
            <TimelineList events={overview.changes} linkItems />
          </div>
        </section>
        <SeasonCards />

        <Modal open={linkOpen} title="Add from a link" description="Harbour stores the link only. The next scan fills in the name, specs, summary, and photo." onClose={() => setLinkOpen(false)}>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault()
              const parsed = pendingItemFromUrl(linkValue)
              if (!parsed.ok) {
                setLinkError(parsed.errors[0]?.message ?? 'Use an http or https link.')
                return
              }
              setLinkPending(true)
              setLinkError(null)
              void catalog.saveItem(parsed.value).then(() => {
                push('ok', 'Link saved. The next scan can fill in the details.')
                setLinkOpen(false)
              }).catch((error: unknown) => {
                setLinkError(error instanceof Error ? error.message : 'Could not save the link.')
              }).finally(() => setLinkPending(false))
            }}
          >
            <input className={controlClass} value={linkValue} onChange={(event) => setLinkValue(event.target.value)} placeholder="https://" aria-label="Product URL" inputMode="url" />
            {linkError ? <p className="text-sm text-clay">{linkError}</p> : null}
            <div className="flex justify-end">
              <button type="submit" className={buttonClass()} disabled={linkPending}>{linkPending ? 'Saving…' : 'Save link'}</button>
            </div>
          </form>
        </Modal>
        <Modal open={editing != null} title={editing === 'new' ? 'New item' : 'Edit item'} description="Every field is saved on the item. Prices themselves come from the daily check." onClose={() => setEditing(null)}>
          {editing != null ? (
            <ItemForm
              key={editing === 'new' ? 'new' : editing.id}
              initial={editing === 'new' ? blankItemDraft() : itemToDraft(editing)}
              categories={categories.filter((entry) => entry !== 'Uncategorized')}
              submitLabel={editing === 'new' ? 'Add item' : 'Save changes'}
              onCancel={() => setEditing(null)}
              onSubmit={async (write) => {
                await catalog.saveItem(write, editing === 'new' ? undefined : editing.id)
                push('ok', editing === 'new' ? 'Item added.' : 'Item saved.')
                setEditing(null)
              }}
            />
          ) : null}
        </Modal>
        <ConfirmDialog
          open={removing != null}
          title={removing ? `Delete ${removing.name}?` : 'Delete item?'}
          body="Price history and deals for this item are removed too."
          confirmLabel={pendingDelete ? 'Deleting…' : 'Delete item'}
          pending={pendingDelete}
          onClose={() => setRemoving(null)}
          onConfirm={() => {
            if (!removing) return
            setPendingDelete(true)
            void catalog.deleteItem(removing.id).then(() => {
              push('ok', 'Item deleted.')
              setRemoving(null)
            }).catch((error: unknown) => {
              push('error', error instanceof Error ? error.message : 'Could not delete the item.')
            }).finally(() => setPendingDelete(false))
          }}
        />
      </div>
    </FadeIn>
  )
}

function watchColumns({
  canEdit,
  onEdit,
  onDelete,
}: {
  canEdit: boolean
  onEdit: (item: Item) => void
  onDelete: (item: Item) => void
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const columns: ColumnDef<Listed, any>[] = [
    columnHelper.accessor((entry) => entry.row.item.name, {
      id: 'item',
      header: 'Item',
      cell: ({ row }) => (
        <div>
          <Link className="font-medium hover:text-pine" to={`/items/${row.original.row.item.id}`}>{row.original.row.item.name}</Link>
          {!row.original.row.item.active ? <span className="ml-2 text-xs text-muted">Paused</span> : null}
        </div>
      ),
    }),
    columnHelper.accessor((entry) => categoryLabel(entry.row.item.category), {
      id: 'category',
      header: 'Category',
      cell: ({ getValue }) => getValue(),
    }),
    columnHelper.accessor((entry) => entry.row.best?.price ?? Number.POSITIVE_INFINITY, {
      id: 'price',
      header: 'Best price',
      cell: ({ row }) => <span className="font-mono tabular-nums">{row.original.row.best ? formatCad(row.original.row.best.price) : '—'}</span>,
    }),
    columnHelper.accessor((entry) => entry.row.best?.storeName ?? '', {
      id: 'store',
      header: 'Store',
      cell: ({ row }) => row.original.row.best?.storeName ?? '—',
    }),
    columnHelper.accessor((entry) => callRank(entry.call?.call), {
      id: 'call',
      header: 'Verdict',
      cell: ({ row }) => row.original.call ? <Badge className={priceCallTone(row.original.call.call)}>{priceCallLabel(row.original.call.call)}</Badge> : '—',
    }),
    columnHelper.accessor((entry) => typicalDelta(entry.brief), {
      id: 'typical',
      header: 'Vs typical',
      cell: ({ row }) => versusTypical(row.original.brief?.currentPrice ?? null, row.original.brief?.timing.median ?? null),
    }),
    columnHelper.accessor((entry) => entry.row.allTimeLow ?? Number.POSITIVE_INFINITY, {
      id: 'low',
      header: 'All-time low',
      cell: ({ row }) => (
        <span className="tabular-nums">
          {row.original.row.allTimeLow != null ? formatCad(row.original.row.allTimeLow) : '—'}
          {row.original.row.atLow ? <span className="ml-2 text-xs text-buy">At the low</span> : null}
        </span>
      ),
    }),
    columnHelper.accessor((entry) => stockRank(entry.row.best?.inStock ?? null), {
      id: 'stock',
      header: 'Stock',
      cell: ({ row }) => <StockBadge inStock={row.original.row.best?.inStock ?? null} />,
    }),
    columnHelper.accessor((entry) => entry.row.best?.capturedAt ?? '', {
      id: 'checked',
      header: 'Checked',
      cell: ({ row }) => <RelativeTime iso={row.original.row.best?.capturedAt} />,
    }),
  ]
  if (canEdit) {
    columns.push(columnHelper.display({
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex gap-1">
          <button type="button" className="rounded-full p-2 text-muted hover:bg-paper" aria-label={`Edit ${row.original.row.item.name}`} onClick={() => onEdit(row.original.row.item)}>
            <Pencil className="h-4 w-4" />
          </button>
          <button type="button" className="rounded-full p-2 text-muted hover:bg-paper" aria-label={`Delete ${row.original.row.item.name}`} onClick={() => onDelete(row.original.row.item)}>
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    }))
  }
  return columns
}

function WatchCard({
  entry,
  canEdit,
  onAlert,
  onEdit,
  onDelete,
}: {
  entry: Listed
  canEdit: boolean
  onAlert: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const item = entry.row.item
  const best = entry.row.best
  return (
    <article className="rounded-xl border border-line bg-paper-2 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-2xl leading-none">
            <Link className="hover:text-pine" to={`/items/${item.id}`}>{item.name}</Link>
          </h3>
          <p className="mt-1 text-sm text-muted">{item.category ? categoryLabel(item.category) : 'No category'}</p>
        </div>
        <p className="font-mono text-2xl tabular-nums">{best ? formatCad(best.price) : '—'}</p>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {entry.call ? <Badge className={priceCallTone(entry.call.call)}>{priceCallLabel(entry.call.call)}</Badge> : null}
        <StockBadge inStock={best?.inStock ?? null} />
        {entry.row.atLow ? <Badge className="bg-buy-soft text-buy">All-time low</Badge> : null}
      </div>
      <p className="mt-2 text-sm text-muted">
        {best ? best.storeName : 'No qualifying offer yet'}
        {' · '}
        {versusTypical(entry.brief?.currentPrice ?? null, entry.brief?.timing.median ?? null)}
        {entry.row.allTimeLow != null ? ` · low ${formatCad(entry.row.allTimeLow)}` : ''}
      </p>
      <div className="mt-3 flex flex-wrap gap-3 text-sm">
        <button type="button" className="text-pine underline" onClick={onAlert}>Get deal alerts</button>
        {safeHttpUrl(item.product_url) ? <a className="text-pine underline" href={safeHttpUrl(item.product_url) ?? undefined} target="_blank" rel="noopener noreferrer">Product link</a> : null}
        {canEdit ? <button type="button" className="text-pine underline" onClick={onEdit}>Edit</button> : null}
        {canEdit ? <button type="button" className="text-clay underline" onClick={onDelete}>Delete</button> : null}
        {canEdit ? <Badge className={priorityTone(item.priority)}>{priorityLabel(item.priority)}</Badge> : null}
      </div>
    </article>
  )
}

function Kpi({ label, value, detail, children }: { label: string; value: string; detail: string; children?: ReactNode }) {
  return (
    <article className="rounded-xl border border-line bg-paper-2 p-4 shadow-sm">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 font-mono text-2xl font-medium tracking-tight tabular-nums">{children ?? value}</p>
      {detail ? <p className="mt-1 text-sm leading-5 text-muted">{detail}</p> : null}
    </article>
  )
}

function StockBadge({ inStock }: { inStock: boolean | null }) {
  if (inStock === false) return <Badge className="bg-skip-soft text-skip">Out of stock</Badge>
  if (inStock === true) return <Badge className="bg-pine-soft text-pine">In stock</Badge>
  return <Badge className="bg-paper text-muted">No offer</Badge>
}

function facetMatch(entry: Listed, facet: { storeId: string | null; stock: string | null; fit: string | null; verdict: string | null }): boolean {
  const best = entry.row.best
  if (facet.storeId && best?.storeId !== facet.storeId) return false
  if (facet.stock === 'in' && !(best && best.inStock !== false)) return false
  if (facet.stock === 'out' && best?.inStock !== false) return false
  if (facet.fit === 'yes' && !best) return false
  if (facet.fit === 'no' && best) return false
  if (facet.verdict && entry.call?.call !== facet.verdict) return false
  return true
}

function callRank(call: PriceCallResult['call'] | undefined): number {
  if (call === 'buy') return 0
  if (call === 'good') return 1
  if (call === 'wait') return 2
  return 3
}

function stockRank(inStock: boolean | null): number {
  if (inStock === true) return 0
  if (inStock == null) return 1
  return 2
}

function typicalDelta(brief: PriceBrief | null): number {
  const current = brief?.currentPrice
  const median = brief?.timing.median
  if (current == null || median == null || median <= 0) return Number.POSITIVE_INFINITY
  return (current - median) / median
}

function positiveInt(value: string | null): number {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1
}
