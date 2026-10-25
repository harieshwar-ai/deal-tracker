import { useMemo, useState } from 'react'
import { FadeIn } from '../components/motion'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useCanEdit } from '../auth/AuthProvider'
import { useAlertSignup } from '../components/AlertSignup'
import { PriceHistoryChart } from '../components/charts'
import { ProductCompare, StoreTable } from '../components/CompareTables'
import { PriceBrief } from '../components/PriceBrief'
import { ProductPhoto } from '../components/product'
import { RequirementChecklist, SpecChecklist } from '../components/SpecChecklist'
import { TimelineList } from '../components/Timeline'
import { ItemForm } from '../components/ItemForm'
import { useToast } from '../components/toast'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger, Badge, Button, ConfirmDialog, EmptyState, LoadingBlock, Modal, Segmented, Select } from '../components/ui'
import { StoreComparison } from '../components/StoreComparison'
import { compareStores } from '../domain/compare'
import { priceBrief } from '../domain/context'
import { compareCandidateProducts, storeRowsFromQuotes } from '../domain/productCompare'
import { clusterDeals } from '../domain/deals'
import { itemToDraft } from '../domain/drafts'
import { discountPercent, formatCad, formatDay, formatRelative, safeHttpUrl } from '../domain/format'
import { buildPriceHistory, historyChartState } from '../domain/history'
import { categoryLabel, priorityLabel, priorityTone, verdictLabel, verdictTone } from '../domain/labels'
import { isQualifying } from '../domain/offers'
import { cheapestEver, chooseBest, offerQuotes } from '../domain/quotes'
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
  const openAlerts = useAlertSignup()
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
    () => offerQuotes(qualifyingSnapshots, catalog.stores),
    [qualifyingSnapshots, catalog.stores],
  )
  const otherQuotes = useMemo(
    () => offerQuotes(snapshots.filter((snapshot) => !isQualifying(snapshot)), catalog.stores),
    [snapshots, catalog.stores],
  )
  const best = chooseBest(quotes)
  const brief = useMemo(() => priceBrief(snapshots, catalog.stores), [catalog.stores, snapshots])
  const products = useMemo(() => compareCandidateProducts(snapshots, catalog.stores), [catalog.stores, snapshots])
  const storeRows = useMemo(
    () => storeRowsFromQuotes(quotes, catalog.deals.filter((deal) => deal.item_id === itemId), qualifyingSnapshots, best?.snapshotId ?? null),
    [best?.snapshotId, catalog.deals, itemId, qualifyingSnapshots, quotes],
  )
  const ever = cheapestEver(qualifyingSnapshots)
  const chartLow = ever && !ever.outOfStock ? ever.snapshot.price : null
  const deals = clusterDeals(
    catalog.deals.filter((deal) => deal.item_id === itemId && deal.status === 'open'),
    snapshots,
  )
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
    <FadeIn>
    <div>
      <Link className="text-sm text-pine underline" to="/">Watchlist</Link>
      <div className="mt-3 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_15rem]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-3xl leading-tight">{item.name}</h1>
                <Badge className={priorityTone(item.priority)}>{priorityLabel(item.priority)}</Badge>
                {!item.active ? <Badge className="bg-paper text-muted">Paused</Badge> : null}
                {item.enrichment_status === 'pending_enrichment' ? <Badge className="bg-gold-soft text-gold">Waiting for the next scan</Badge> : null}
              </div>
              <p className="mt-1 text-sm font-medium text-muted">
                {[item.category ? categoryLabel(item.category) : null, item.condition].filter(Boolean).join(' · ') || 'No category'}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => openAlerts({ itemId: item.id, itemName: item.name, category: item.category })}>Get deal alerts</Button>
              {canEdit ? <Button variant="secondary" onClick={() => setEditing(true)}>Edit</Button> : null}
              {canEdit ? <Button variant="danger" onClick={() => setRemoving(true)}>Delete</Button> : null}
            </div>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-6">
            <Badge className={priceCallTone(call.call)}>{priceCallLabel(call.call)}</Badge>
            <span className="ml-2">{call.reason}</span>
            <span className="font-medium text-muted"> Confidence {call.confidence}.</span>
          </p>
          {item.public_summary ? <p className="mt-3 max-w-2xl text-sm leading-6">{item.public_summary}</p> : null}
          <SpecChecklist specs={item.specs} />
          {canEdit ? <RequirementChecklist specs={item.specs} requirements={item.requirements} /> : null}
          {canEdit && item.description ? <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">{item.description}</p> : null}
          {item.keywords.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-2">
              {item.keywords.map((keyword) => <li key={keyword}><Badge className="bg-paper text-muted">{keyword}</Badge></li>)}
            </ul>
          ) : null}
          {canEdit && item.notes ? <p className="mt-3 max-w-2xl rounded-xl bg-paper px-4 py-3 text-sm leading-6">{item.notes}</p> : null}
        </div>
        <aside className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-3 rounded-xl border border-line bg-paper-2 p-3 shadow-sm lg:grid-cols-1">
          <div className="overflow-hidden rounded-lg lg:max-h-32">
            <ProductPhoto name={item.name} imageUrl={item.image_url} category={item.category} />
          </div>
          <div>
            <p className="text-xs font-medium tracking-wide text-muted uppercase">Current qualifying price</p>
            <p className="mt-1 font-mono text-3xl font-medium tracking-tight tabular-nums">{best ? formatCad(best.price) : '—'}</p>
            <p className="mt-1 text-sm font-medium text-muted">
              {best ? `${best.storeName} · ${formatRelative(best.capturedAt)}` : otherQuotes.length > 0 ? 'No qualifying offer yet' : 'No price yet'}
            </p>
            {best?.productName ? <p className="mt-1 text-sm">{best.productName}</p> : null}
          </div>
        </aside>
      </div>

      <PriceBrief
        brief={brief}
        owner={canEdit ? {
          target: item.target_price != null ? formatCad(item.target_price) : '—',
          max: item.max_price != null ? formatCad(item.max_price) : '—',
          gap: gap == null ? 'Set a target to compare' : gap <= 0 ? `${formatCad(Math.abs(gap))} under target` : `${formatCad(gap)} over target`,
        } : null}
      />

      <section id="compare" className="mt-8">
        <h2 className="font-display text-2xl">Compare products</h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-muted">
          Each column is one product. Colour, finish, and size options of the same model stay together, priced at the lowest in-stock option. Totals add 13% Ontario HST. Shipping is added only when a scan saved it. A price counts toward the lowest and the best total only when it meets the specs and is in stock.
        </p>
        <ProductCompare products={products} />
      </section>

      <section className="mt-8">
        <h2 className="font-display text-2xl">Compare stores</h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-muted">Current qualifying price at each store. Ontario HST is 13% of the item price. Shipping is added when a scan saved it. The same model in another colour, finish, or size is listed once, at its lowest in-stock price.</p>
        {quotes.length === 0 ? <p className="mt-3 text-sm">No qualifying offer yet</p> : (
          <div className="mt-3">
            <StoreTable rows={storeRows} />
          </div>
        )}
        {otherQuotes.length > 0 ? (
          <Accordion type="single" collapsible className="mt-6">
            <AccordionItem value="other">
              <AccordionTrigger>Other offers seen</AccordionTrigger>
              <AccordionContent>
                <p className="text-sm text-muted">Unverified listings, and listings that do not meet the specs. They are left out of the best price.</p>
                <StoreComparison offers={compareStores(otherQuotes, deals.map((cluster) => cluster.deal), null)} muted />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        ) : null}
      </section>

      <section className="mt-8">
        <h2 className="font-display text-2xl">Price changes</h2>
        <div className="mt-3">
          <TimelineList events={changes} linkItems={false} />
        </div>
      </section>

      <section className="mt-8 rounded-xl border border-line bg-paper-2 shadow-sm p-4 md:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl">Price history</h2>
            <p className="mt-1 text-sm text-muted">{canEdit ? 'Qualifying CAD prices. Green marks the lowest in-stock price. The gold dashed line is your target.' : 'Qualifying CAD prices. Green marks the lowest in-stock price.'}</p>
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
            <PriceHistoryChart rows={history.rows} series={history.series} target={canEdit ? item.target_price : null} low={chartLow} points={historyChartState(history.rows.length) === 'points'} />
          </div>
        )}
      </section>

      <section className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display text-2xl">Snapshots</h2>
          <div className="flex flex-wrap gap-2">
            <Select
              label="Filter snapshots by store"
              value={storeFilter}
              onValueChange={setStoreFilter}
              options={[{ value: 'all', label: 'All stores' }, ...catalog.stores.map((store) => ({ value: store.id, label: store.name }))]}
            />
            <Select
              label="Sort snapshots"
              value={sort}
              onValueChange={(value) => setSort(parseSnapshotSort(value))}
              options={[
                { value: 'newest', label: 'Newest' },
                { value: 'price', label: 'Lowest price' },
                { value: 'store', label: 'Store' },
              ]}
            />
          </div>
        </div>
        {ordered.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No snapshots for this filter.</p>
        ) : (
          <div className="mt-4 max-h-[32rem] overflow-auto rounded-xl border border-line shadow-sm">
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
                      <td className="px-4 py-3">{storeName}</td>
                      <td className="px-4 py-3">
                        {href ? <a className="underline" href={href} target="_blank" rel="noopener noreferrer">{snapshot.product_name || snapshot.product_title || 'Listing'}</a> : (snapshot.product_name || snapshot.product_title || '—')}
                        {snapshot.meets_requirements === false ? <span className="mt-1 block text-xs text-muted">Doesn't meet specs</span> : null}
                        {snapshot.meets_requirements == null ? <span className="mt-1 block text-xs text-muted">Unverified</span> : null}
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {formatCad(snapshot.price)}
                        {snapshot.currency !== 'CAD' ? ` ${snapshot.currency}` : ''}
                        {discount != null && discount > 0 ? <span className="text-drop"> {discount.toFixed(0)}%</span> : null}
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
            {deals.map((cluster) => (
              <li key={cluster.deal.id} className="rounded-2xl border border-line bg-paper-2 px-4 py-3 text-sm">
                <Badge className={verdictTone(cluster.deal.verdict ?? 'unrated')}>{verdictLabel(cluster.deal.verdict ?? 'unrated')}</Badge>
                <span className="ml-2">{cluster.deal.title}</span>
                <span className="ml-2 tabular-nums">{formatCad(cluster.deal.price)}</span>
                {cluster.options.length > 1 ? (
                  <ul className="mt-2 grid gap-1 text-muted">
                    {cluster.options.map((option) => (
                      <li key={`${option.label ?? 'option'}-${option.price}`}>
                        {option.label ? `${option.label} · ` : ''}{formatCad(option.price)}
                        {safeHttpUrl(option.url) ? <a className="ml-2 text-pine underline" href={safeHttpUrl(option.url) ?? undefined} target="_blank" rel="noopener noreferrer">Open</a> : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
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
    </FadeIn>
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
