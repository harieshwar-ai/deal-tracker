import { Pencil, Plus, Trash2 } from 'lucide-react'
import { motion, useIsPresent } from 'motion/react'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useCanEdit } from '../auth/AuthProvider'
import { HeroStrip } from '../components/HeroStrip'
import { SeasonCards } from '../components/SeasonCards'
import { OfferChip } from '../components/OfferVariants'
import { ProductPhoto } from '../components/product'
import { SpecChecklist } from '../components/SpecChecklist'
import { Sparkline } from '../components/Sparkline'
import { TimelineList } from '../components/Timeline'
import { ItemForm } from '../components/ItemForm'
import { useToast } from '../components/toast'
import { FadeIn, useTween } from '../components/motion'
import { Badge, buttonClass, ConfirmDialog, controlClass, EmptyState, ErrorState, LoadingBlock, Modal, Segmented, Select } from '../components/ui'
import { blankItemDraft, itemToDraft, pendingItemFromUrl } from '../domain/drafts'
import { parseActivity, parsePriorityFilter, parseSort } from '../domain/filters'
import { formatCad, formatRelative, safeHttpUrl } from '../domain/format'
import { heroStats } from '../domain/hero'
import { priorityLabel, priorityTone, sortLabel, verdictLabel, verdictTone } from '../domain/labels'
import type { Item, WatchSort } from '../domain/types'
import { buildTimeline } from '../domain/timeline'
import { priceCallLabel, priceCallsForDataset, priceCallTone } from '../domain/verdict'
import { buildWatchRows, filterWatchRows, sortWatchRows, watchCategories } from '../domain/watchlist'
import type { WatchRow } from '../domain/watchlist'
import { writeParams } from '../lib/search'
import { useDocumentTitle } from '../lib/title'
import { useCatalog } from '../state/catalog'

const sorts: WatchSort[] = ['target_gap', 'price_asc', 'priority', 'name', 'updated']

export function WatchlistPage() {
  useDocumentTitle('Watchlist')
  const catalog = useCatalog()
  const canEdit = useCanEdit()
  const push = useToast()
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
  const requestedSort = parseSort(params.get('sort'))
  const sort = !canEdit && requestedSort === 'target_gap' ? 'price_asc' : requestedSort
  const criteria = { query, category, priority, activity, sort }
  const rows = useMemo(() => {
    const built = buildWatchRows({
      items: catalog.items,
      stores: catalog.stores,
      snapshots: catalog.snapshots,
      deals: catalog.deals,
    })
    return sortWatchRows(filterWatchRows(built, { query, category, priority, activity, sort }), sort)
  }, [catalog.items, catalog.stores, catalog.snapshots, catalog.deals, query, category, priority, activity, sort])
  const categories = watchCategories(catalog.items)
  const calls = useMemo(
    () => priceCallsForDataset(catalog, canEdit),
    [catalog, canEdit],
  )
  const hero = useMemo(() => heroStats(catalog, canEdit), [catalog, canEdit])
  const changes = useMemo(() => buildTimeline(catalog).slice(0, 8), [catalog])

  function update(updates: Record<string, string | null>) {
    setParams(writeParams(params, updates), { replace: true })
  }

  if (!catalog.ready) return <LoadingBlock />
  if (catalog.error && catalog.items.length === 0 && catalog.stores.length === 0) {
    return <ErrorState message={catalog.error} onRetry={() => void catalog.refresh()} />
  }

  return (
    <FadeIn>
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl">Watchlist</h1>
          <p className="mt-1 text-sm text-muted">{catalog.items.filter((item) => item.active).length} active items</p>
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
      <HeroStrip stats={hero} />
      <div className="mt-6 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
        <input
          className={controlClass}
          value={criteria.query}
          onChange={(event) => update({ q: event.target.value || null })}
          placeholder="Search name, notes, keywords"
          aria-label="Search items"
        />
        <Select
          label="Category"
          value={criteria.category ?? 'all'}
          onValueChange={(value) => update({ category: value === 'all' ? null : value })}
          options={[{ value: 'all', label: 'All categories' }, ...categories.map((category) => ({ value: category, label: category }))]}
        />
        <Select
          label="Priority"
          value={criteria.priority}
          onValueChange={(value) => update({ priority: value === 'all' ? null : value })}
          options={[
            { value: 'all', label: 'All priorities' },
            { value: 'high', label: 'High' },
            { value: 'normal', label: 'Normal' },
            { value: 'low', label: 'Low' },
          ]}
        />
        <Select
          label="Sort"
          value={criteria.sort}
          onValueChange={(value) => update({ sort: value === 'target_gap' ? null : value })}
          options={(canEdit ? sorts : sorts.filter((entry) => entry !== 'target_gap')).map((sort) => ({ value: sort, label: sortLabel(sort) }))}
        />
      </div>
      <div className="mt-3">
        <Segmented
          label="Activity"
          value={criteria.activity}
          onChange={(activity) => update({ activity: activity === 'active' ? null : activity })}
          options={[
            { value: 'active', label: 'Active' },
            { value: 'paused', label: 'Paused' },
            { value: 'all', label: 'All' },
          ]}
        />
      </div>
      {catalog.items.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="Nothing to watch yet"
            body={canEdit
              ? 'Add the things you actually want to buy. The daily check will attach prices from the stores you keep enabled.'
              : 'The watchlist is empty right now. Prices show up here after the owner adds an item.'}
            action={canEdit ? <button type="button" className={buttonClass()} onClick={() => setEditing('new')}>Add the first item</button> : undefined}
          />
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-8">
          <EmptyState title="No items match" body="Clear a filter or try a different search." />
        </div>
      ) : (
        <div className="mt-6 grid gap-4">
          {rows.map((row, index) => (
            <WatchCard
              key={row.item.id}
              index={index}
              row={row}
              call={calls.get(row.item.id) ?? null}
              canEdit={canEdit}
              onEdit={() => setEditing(row.item)}
              onDelete={() => setRemoving(row.item)}
            />
          ))}
        </div>
      )}
      <SeasonCards />
      <section className="mt-8">
        <h2 className="font-display text-2xl">Recent price changes</h2>
        <div className="mt-3">
          <TimelineList events={changes} linkItems />
        </div>
      </section>
      <Modal
        open={linkOpen}
        title="Add from a link"
        description="Harbour stores the link only. The next scan fills in the name, specs, summary, and photo."
        onClose={() => setLinkOpen(false)}
      >
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
          <input
            className={controlClass}
            value={linkValue}
            onChange={(event) => setLinkValue(event.target.value)}
            placeholder="https://"
            aria-label="Product URL"
            inputMode="url"
          />
          {linkError ? <p className="text-sm text-clay">{linkError}</p> : null}
          <div className="flex justify-end">
            <button type="submit" className={buttonClass()} disabled={linkPending}>{linkPending ? 'Saving…' : 'Save link'}</button>
          </div>
        </form>
      </Modal>
      <Modal
        open={editing != null}
        title={editing === 'new' ? 'New item' : 'Edit item'}
        description="Every field is saved on the item. Prices themselves come from the daily check."
        onClose={() => setEditing(null)}
      >
        {editing != null ? (
          <ItemForm
            key={editing === 'new' ? 'new' : editing.id}
            initial={editing === 'new' ? blankItemDraft() : itemToDraft(editing)}
            categories={categories.filter((category) => category !== 'Uncategorized')}
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

function WatchCard({
  index,
  row,
  call,
  canEdit,
  onEdit,
  onDelete,
}: {
  index: number
  row: WatchRow
  call: { call: 'buy' | 'good' | 'wait'; confidence: number; reason: string } | null
  canEdit: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  const gap = gapCopy(row.targetGap)
  const deal = row.openDeal
  const tween = useTween(index)
  const present = useIsPresent()
  return (
    <motion.article
      layout={present && !tween.reduce}
      initial={tween.reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={tween.reduce ? undefined : { y: -2 }}
      transition={tween.transition}
      className="overflow-hidden rounded-xl border border-line bg-paper-2 shadow-sm"
    >
      <div className="grid sm:grid-cols-[8.5rem_minmax(0,1fr)]">
        <ProductPhoto name={row.item.name} imageUrl={row.item.image_url} category={row.item.category} />
        <div className="p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-3xl leading-none">
              <Link className="hover:text-pine" to={`/items/${row.item.id}`}>{row.item.name}</Link>
            </h2>
            <Badge className={priorityTone(row.item.priority)}>{priorityLabel(row.item.priority)}</Badge>
            {!row.item.active ? <Badge className="bg-paper text-muted">Paused</Badge> : null}
            {row.item.enrichment_status === 'pending_enrichment' ? <Badge className="bg-gold-soft text-gold">Waiting for the next scan</Badge> : null}
            {call ? <Badge className={priceCallTone(call.call)}>{priceCallLabel(call.call)}</Badge> : null}
            {row.atLow ? <Badge className="bg-gold-soft text-gold">All-time low</Badge> : null}
            {deal ? <Badge className={verdictTone(deal.verdict ?? 'unrated')}>{verdictLabel(deal.verdict ?? 'unrated')}</Badge> : null}
          </div>
          <p className="mt-2 text-sm text-muted">
            {[row.item.category, row.item.condition].filter(Boolean).join(' · ') || 'No category'}
            {canEdit && row.item.target_price != null ? ` · target ${formatCad(row.item.target_price)}` : ''}
          </p>
          {!canEdit && row.item.public_summary ? <p className="mt-2 text-sm leading-6 text-ink">{row.item.public_summary}</p> : null}
          <SpecChecklist specs={row.item.specs} />
          {call ? <p className="mt-2 max-w-xl text-sm leading-6">{call.reason} <span className="text-muted">Confidence {call.confidence}.</span></p> : null}
          {safeHttpUrl(row.item.product_url) ? <a className="mt-2 inline-block text-sm text-pine underline" href={safeHttpUrl(row.item.product_url) ?? undefined} target="_blank" rel="noopener noreferrer">Product link</a> : null}
        </div>
        <div className="text-left sm:text-right">
          <p className="font-mono text-3xl font-medium tracking-tight tabular-nums">{row.best ? formatCad(row.best.price) : '—'}</p>
          <p className="text-sm text-muted">
            {row.best ? `${row.best.storeName} · ${formatRelative(row.best.capturedAt)}` : row.other.length > 0 ? 'No qualifying offer yet' : 'No price yet'}
            {row.best?.inStock === false ? ' · Out of stock' : ''}
          </p>
          {row.best?.productName ? <p className="text-sm text-muted">{row.best.productName}</p> : null}
          {canEdit && gap ? <p className={`text-sm ${gap.className}`}>{gap.text}</p> : null}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <Sparkline values={row.spark} />
        <ul className="flex min-w-0 flex-1 flex-wrap gap-2">
          {row.quotes.length === 0 && row.other.length === 0 ? <li className="text-sm text-muted">Waiting for the first snapshot.</li> : null}
          {row.quotes.length === 0 && row.other.length > 0 ? <li className="text-sm text-muted">Other offers seen, none qualify yet.</li> : null}
          {row.quotes.map((quote) => (
            <OfferChip key={`${quote.storeId ?? 'unknown'}-${quote.snapshotId}`} quote={quote} best={row.best?.snapshotId === quote.snapshotId} />
          ))}
        </ul>
        {canEdit ? (
          <div className="flex gap-1">
            <button type="button" className="rounded-full p-2 text-muted hover:bg-paper" aria-label={`Edit ${row.item.name}`} onClick={onEdit}>
              <Pencil className="h-4 w-4" />
            </button>
            <button type="button" className="rounded-full p-2 text-muted hover:bg-paper" aria-label={`Delete ${row.item.name}`} onClick={onDelete}>
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </div>
        </div>
      </div>
    </motion.article>
  )
}

function gapCopy(gap: number | null): { text: string; className: string } | null {
  if (gap == null) return null
  if (Math.abs(gap) < 0.005) return { text: 'At target', className: 'text-pine' }
  if (gap < 0) return { text: `${formatCad(Math.abs(gap))} under target`, className: 'text-pine' }
  return { text: `${formatCad(gap)} over target`, className: 'text-clay' }
}
