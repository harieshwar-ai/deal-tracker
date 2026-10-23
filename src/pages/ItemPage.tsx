import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useCanEdit } from '../auth/AuthProvider'
import { PriceHistoryChart } from '../components/charts'
import { StoreComparison } from '../components/StoreComparison'
import { ProductPhoto } from '../components/product'
import { RequirementChecklist, SpecChecklist } from '../components/SpecChecklist'
import { TimelineList } from '../components/Timeline'
import { ItemForm } from '../components/ItemForm'
import { useToast } from '../components/toast'
import { Badge, Button, ConfirmDialog, EmptyState, LoadingBlock, Modal, Segmented } from '../components/ui'
import { compareStores } from '../domain/compare'
import { itemToDraft } from '../domain/drafts'
import { discountPercent, formatCad, formatDay, formatPct, formatRelative, safeHttpUrl } from '../domain/format'
import { buildPriceHistory, historyChartState } from '../domain/history'
import { priorityLabel, priorityTone, verdictLabel, verdictTone } from '../domain/labels'
import { isQualifying } from '../domain/offers'
import { allTimeLow, chooseBest, latestOffers, quoteFromSnapshot } from '../domain/quotes'
import { buildTimeline } from '../domain/timeline'
import { priceCallForItem, priceCallLabel, priceCallTone } from '../domain/verdict'
import { watchCategories } from '../domain/watchlist'
import { useDocumentTitle } from '../lib/title'
import { useCatalog } from '../state/catalog'

type SnapshotSort = 'newest' | 'price' | 'store'

export function ItemPage() {
  const { itemId } = useParams()
  const catalog = useCatalog()
  const canEdit = useCanEdit()
  const navigate = useNavigate()
  const push = useToast()
  const item = catalog.items.find((entry) => entry.id === itemId)
  useDocumentTitle(item?.name ?? 'Item', item?.public_summary)
  const [editing, setEditing] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [pendingDelete, setPendingDelete] = useState(false)
  const [sort, setSort] = useState<SnapshotSort>('newest')
  const [storeFilter, setStoreFilter] = useState('all')
  const [chartOffers, setChartOffers] = useState<'qualifying' | 'all'>('qualifying')

  const snapshots = useMemo(
    () => catalog.snapshots.filter((snapshot) => snapshot.item_id === itemId),
    [catalog.snapshots, itemId],
  )
  const qualifyingSnapshots = useMemo(() => snapshots.filter(isQualifying), [snapshots])
  const chartSnapshots = chartOffers === 'all' ? snapshots : qualifyingSnapshots
  const history = useMemo(() => buildPriceHistory(chartSnapshots, catalog.stores), [chartSnapshots, catalog.stores])
  const quotes = useMemo(
    () => latestOffers(qualifyingSnapshots).map((snapshot) => quoteFromSnapshot(snapshot, catalog.stores)),
    [qualifyingSnapshots, catalog.stores],
  )
  const otherQuotes = useMemo(
    () => latestOffers(snapshots.filter((snapshot) => !isQualifying(snapshot))).map((snapshot) => quoteFromSnapshot(snapshot, catalog.stores)),
    [snapshots, catalog.stores],
  )
  const best = chooseBest(quotes)
  const low = allTimeLow(qualifyingSnapshots)
  const deals = catalog.deals.filter((deal) => deal.item_id === itemId && deal.status === 'open')
  const filtered = snapshots.filter((snapshot) => storeFilter === 'all' || snapshot.store_id === storeFilter)
  const ordered = [...filtered].sort((left, right) => compareSnapshots(left, right, sort, catalog.stores))
  const changes = useMemo(
    () => buildTimeline({ ...catalog, items: catalog.items.filter((entry) => entry.id === itemId), snapshots }).filter((event) => event.itemId === itemId),
    [catalog, itemId, snapshots],
  )

  if (!catalog.ready) return <LoadingBlock />
  if (!item) {
    return (
      <EmptyState
        title="That item is not on the list"
        body="It may have been deleted, or the link is out of date."
        action={<Link className="text-pine underline" to="/">Back to the watchlist</Link>}
      />
    )
  }

  const gap = best && item.target_price != null ? best.price - item.target_price : null
  const call = priceCallForItem({
    item,
    snapshots,
    deals: catalog.deals.filter((deal) => deal.item_id === item.id),
    stores: catalog.stores,
    includeTarget: canEdit,
  })

  return (
    <div>
      <Link className="text-sm text-pine underline" to="/">Watchlist</Link>
      <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-start">
        <div>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-4xl">{item.name}</h1>
                <Badge className={priorityTone(item.priority)}>{priorityLabel(item.priority)}</Badge>
                {!item.active ? <Badge className="bg-paper text-muted">Paused</Badge> : null}
                {item.enrichment_status === 'pending_enrichment' ? <Badge className="bg-gold-soft text-gold">Waiting for the next scan</Badge> : null}
              </div>
              <p className="mt-2 text-sm text-muted">
                {[item.category, item.condition].filter(Boolean).join(' · ') || 'No category'}
              </p>
            </div>
            {canEdit ? (
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setEditing(true)}>Edit</Button>
                <Button variant="danger" onClick={() => setRemoving(true)}>Delete</Button>
              </div>
            ) : null}
          </div>
          <p className="mt-4 max-w-2xl text-sm leading-6">
            <Badge className={priceCallTone(call.call)}>{priceCallLabel(call.call)}</Badge>
            <span className="ml-2">{call.reason}</span>
            <span className="text-muted"> Confidence {call.confidence}.</span>
          </p>
        </div>
        <aside className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-center gap-3 rounded-3xl border border-line bg-paper-2 p-3 lg:grid-cols-1">
          <div className="overflow-hidden rounded-2xl">
            <ProductPhoto name={item.name} imageUrl={item.image_url} />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-muted">Current qualifying price</p>
            <p className="mt-1 font-display text-4xl tabular-nums">{best ? formatCad(best.price) : '—'}</p>
            <p className="mt-1 text-sm text-muted">
              {best ? `${best.storeName} · ${formatRelative(best.capturedAt)}` : otherQuotes.length > 0 ? 'No qualifying offer yet' : 'No price yet'}
            </p>
            {best?.productName ? <p className="mt-1 text-sm">{best.productName}</p> : null}
          </div>
        </aside>
      </div>
      {item.public_summary ? <p className="mt-4 max-w-2xl text-sm leading-6">{item.public_summary}</p> : null}
      <SpecChecklist specs={item.specs} />
      {canEdit ? <RequirementChecklist specs={item.specs} requirements={item.requirements} /> : null}
      {canEdit && item.description ? <p className="mt-4 max-w-2xl text-sm leading-6 text-muted">{item.description}</p> : null}
      {item.keywords.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {item.keywords.map((keyword) => <li key={keyword}><Badge className="bg-paper text-muted">{keyword}</Badge></li>)}
        </ul>
      ) : null}
      {canEdit && item.notes ? <p className="mt-4 max-w-2xl rounded-2xl bg-paper px-4 py-3 text-sm leading-6">{item.notes}</p> : null}

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Current best" value={best ? formatCad(best.price) : '—'} detail={best ? `${best.storeName} · ${formatRelative(best.capturedAt)}` : otherQuotes.length > 0 ? 'No qualifying offer yet' : 'No in-stock CAD price yet'} />
        <Stat label="Cheapest ever" value={low ? formatCad(low.price) : '—'} detail={low ? `${catalog.stores.find((store) => store.id === low.store_id)?.name ?? 'Unknown store'} · ${formatDay(low.captured_at)}` : qualifyingSnapshots.length > 0 ? 'No CAD snapshots yet' : 'No qualifying offer yet'} />
        {canEdit ? (
          <Stat label="Target" value={item.target_price != null ? formatCad(item.target_price) : '—'} detail={gap == null ? 'Set a target to compare' : gap <= 0 ? `${formatCad(Math.abs(gap))} under target` : `${formatCad(gap)} over target`} />
        ) : (
          <Stat label="Vs regular" value={best?.regularPrice != null && best.regularPrice > best.price ? formatCad(best.regularPrice - best.price) : '—'} detail={best?.regularPrice != null ? `Regular ${formatCad(best.regularPrice)}` : 'No regular price on the current offer'} />
        )}
        {canEdit ? (
          <Stat label="Max price" value={item.max_price != null ? formatCad(item.max_price) : '—'} detail={`${snapshots.length} snapshots · ${deals.length} open deals`} />
        ) : (
          <Stat label="From all-time low" value={best && low && low.price > 0 ? formatPct(((best.price - low.price) / low.price) * 100, 0) : '—'} detail={low ? 'Compared with the lowest qualifying CAD price' : 'No qualifying offer yet'} />
        )}
      </div>

      <section className="mt-8">
        <h2 className="font-display text-2xl">Stores</h2>
        <p className="mt-1 text-sm text-muted">Current qualifying price at each store. Ontario HST is 13% of the item price. Shipping is added when a scan saved it.</p>
        {quotes.length === 0 ? <p className="mt-3 text-sm">No qualifying offer yet</p> : <StoreComparison offers={compareStores(quotes, deals, best?.snapshotId ?? null)} />}
        {otherQuotes.length > 0 ? (
          <div className="mt-6">
            <h3 className="font-display text-xl text-muted">Other offers seen</h3>
            <p className="mt-1 text-sm text-muted">Unverified listings, and listings that do not meet the specs. They are left out of the best price.</p>
            <StoreComparison offers={compareStores(otherQuotes, deals, null)} muted />
          </div>
        ) : null}
      </section>

      <section className="mt-8">
        <h2 className="font-display text-2xl">Price changes</h2>
        <div className="mt-3">
          <TimelineList events={changes} linkItems={false} />
        </div>
      </section>

      <section className="mt-8 rounded-3xl border border-line bg-paper-2 p-4 md:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl">Price history</h2>
            <p className="mt-1 text-sm text-muted">{canEdit ? 'Qualifying CAD prices. Green marks the qualifying all-time low. The gold dashed line is your target.' : 'Qualifying CAD prices. Green marks the qualifying all-time low.'}</p>
          </div>
          <Segmented
            label="Chart offers"
            value={chartOffers}
            onChange={setChartOffers}
            options={[
              { value: 'qualifying', label: 'Qualifying' },
              { value: 'all', label: 'All offers' },
            ]}
          />
        </div>
        {historyChartState(history.rows.length) === 'empty' ? (
          <div className="mt-4">
            <EmptyState title={chartOffers === 'all' ? 'No prices yet' : 'No qualifying offer yet'} body={chartOffers === 'all' ? 'Once the daily check records a snapshot, the chart and the table below will fill in.' : 'Prices that are unverified or do not meet the specs stay off this chart until you choose all offers.'} />
          </div>
        ) : (
          <div className="mt-4">
            {historyChartState(history.rows.length) === 'points' ? (
              <p className="mb-3 text-sm leading-6 text-muted">Fewer than five days are saved. Each dot is a price, and each line follows one product at one store.</p>
            ) : null}
            <PriceHistoryChart rows={history.rows} series={history.series} target={canEdit ? item.target_price : null} low={low?.price ?? null} points={historyChartState(history.rows.length) === 'points'} />
          </div>
        )}
      </section>

      <section className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display text-2xl">Snapshots</h2>
          <div className="flex flex-wrap gap-2">
            <select className="rounded-full border border-line bg-paper-2 px-3 py-2 text-base md:py-1.5 md:text-sm" aria-label="Filter snapshots by store" value={storeFilter} onChange={(event) => setStoreFilter(event.target.value)}>
              <option value="all">All stores</option>
              {catalog.stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}
            </select>
            <select className="rounded-full border border-line bg-paper-2 px-3 py-2 text-base md:py-1.5 md:text-sm" aria-label="Sort snapshots" value={sort} onChange={(event) => setSort(parseSnapshotSort(event.target.value))}>
              <option value="newest">Newest</option>
              <option value="price">Lowest price</option>
              <option value="store">Store</option>
            </select>
          </div>
        </div>
        {ordered.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No snapshots for this filter.</p>
        ) : (
          <div className="mt-4 max-h-[32rem] overflow-auto rounded-3xl border border-line">
            <table className="w-full min-w-[44rem] text-left text-sm">
              <caption className="sr-only">Price snapshots for {item.name}</caption>
              <thead className="sticky top-0 bg-paper text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">When</th>
                  <th className="px-4 py-3 font-medium">Store</th>
                  <th className="px-4 py-3 font-medium">Product</th>
                  <th className="px-4 py-3 font-medium">Price</th>
                  <th className="px-4 py-3 font-medium">Regular</th>
                  <th className="px-4 py-3 font-medium">Stock</th>
                </tr>
              </thead>
              <tbody className="bg-paper-2">
                {ordered.map((snapshot) => {
                  const href = safeHttpUrl(snapshot.product_url)
                  const storeName = catalog.stores.find((store) => store.id === snapshot.store_id)?.name ?? 'Unknown store'
                  const discount = discountPercent(snapshot.price, snapshot.regular_price)
                  return (
                    <tr key={snapshot.id} className="border-t border-line">
                      <td className="px-4 py-3 whitespace-nowrap">{formatDay(snapshot.captured_at)}</td>
                      <td className="px-4 py-3">{storeName}{snapshot.member_only ? ' · member' : ''}</td>
                      <td className="px-4 py-3">
                        {href ? <a className="underline" href={href} target="_blank" rel="noopener noreferrer">{snapshot.product_name || snapshot.product_title || 'Listing'}</a> : (snapshot.product_name || snapshot.product_title || '—')}
                        {snapshot.meets_requirements === false ? <span className="mt-1 block text-xs text-muted">Doesn't meet specs</span> : null}
                        {snapshot.meets_requirements == null ? <span className="mt-1 block text-xs text-muted">Unverified</span> : null}
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {formatCad(snapshot.price)}
                        {snapshot.currency !== 'CAD' ? ` ${snapshot.currency}` : ''}
                        {discount != null && discount > 0 ? <span className="text-pine"> {discount.toFixed(0)}%</span> : null}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-muted">{snapshot.regular_price != null ? formatCad(snapshot.regular_price) : '—'}</td>
                      <td className="px-4 py-3">{snapshot.in_stock == null ? '—' : snapshot.in_stock ? 'In stock' : 'Out of stock'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {deals.length > 0 ? (
        <section className="mt-8">
          <h2 className="font-display text-2xl">Open deals</h2>
          <ul className="mt-3 grid gap-2">
            {deals.map((deal) => (
              <li key={deal.id} className="rounded-2xl border border-line bg-paper-2 px-4 py-3 text-sm">
                <Badge className={verdictTone(deal.verdict ?? 'unrated')}>{verdictLabel(deal.verdict ?? 'unrated')}</Badge>
                <span className="ml-2">{deal.title}</span>
                <span className="ml-2 tabular-nums">{formatCad(deal.price)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Modal open={editing} title="Edit item" onClose={() => setEditing(false)}>
        <ItemForm
          key={item.updated_at}
          initial={itemToDraft(item)}
          categories={watchCategories(catalog.items).filter((category) => category !== 'Uncategorized')}
          submitLabel="Save changes"
          onCancel={() => setEditing(false)}
          onSubmit={async (write) => {
            await catalog.saveItem(write, item.id)
            push('ok', 'Item saved.')
            setEditing(false)
          }}
        />
      </Modal>
      <ConfirmDialog
        open={removing}
        title={`Delete ${item.name}?`}
        body="Price history and deals for this item are removed too."
        confirmLabel={pendingDelete ? 'Deleting…' : 'Delete item'}
        pending={pendingDelete}
        onClose={() => setRemoving(false)}
        onConfirm={() => {
          setPendingDelete(true)
          void catalog.deleteItem(item.id).then(() => {
            push('ok', 'Item deleted.')
            navigate('/')
          }).catch((error: unknown) => {
            push('error', error instanceof Error ? error.message : 'Could not delete the item.')
            setPendingDelete(false)
          })
        }}
      />
    </div>
  )
}

function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className="rounded-3xl border border-line bg-paper-2 p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 font-display text-3xl tabular-nums">{value}</p>
      <p className="mt-1 text-sm text-muted">{detail}</p>
    </article>
  )
}

function parseSnapshotSort(value: string): SnapshotSort {
  switch (value) {
    case 'newest':
    case 'price':
    case 'store':
      return value
    default:
      return 'newest'
  }
}

function compareSnapshots(
  left: { captured_at: string; price: number; store_id: string | null },
  right: { captured_at: string; price: number; store_id: string | null },
  sort: SnapshotSort,
  stores: { id: string; name: string }[],
): number {
  switch (sort) {
    case 'newest':
      return right.captured_at.localeCompare(left.captured_at)
    case 'price':
      return left.price - right.price
    case 'store':
      return storeLabel(stores, left.store_id).localeCompare(storeLabel(stores, right.store_id))
    default: {
      const neverSort: never = sort
      return neverSort
    }
  }
}

function storeLabel(stores: { id: string; name: string }[], id: string | null): string {
  if (!id) return 'Unknown store'
  return stores.find((store) => store.id === id)?.name ?? 'Unknown store'
}
