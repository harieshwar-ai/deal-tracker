import { createColumnHelper } from '@tanstack/react-table'
import type { ColumnDef, SortingState } from '@tanstack/react-table'
import { Rows3 } from 'lucide-react'
import { useMemo, useState, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useCanEdit } from '../auth/AuthProvider'
import { MarketTable } from '../components/MarketTable'
import { RelativeTime } from '../components/RelativeTime'
import { useToast } from '../components/toast'
import { FadeIn } from '../components/motion'
import { Badge, Button, EmptyState, ErrorState, LoadingBlock, Segmented, Select, buttonClass } from '../components/ui'
import { clusterDeals, latestDealStock, verdictGroup } from '../domain/deals'
import type { DealCluster } from '../domain/deals'
import { parseStatusFilter } from '../domain/filters'
import type { StatusFilter } from '../domain/filters'
import { categoryLabel, statusLabel, verdictLabel, verdictTone } from '../domain/labels'
import { discountPercent, formatCad, formatDay, safeHttpUrl } from '../domain/format'
import type { Deal, DealStatus } from '../domain/types'
import { writeParams } from '../lib/search'
import { useDocumentTitle } from '../lib/title'
import { useCatalog } from '../state/catalog'

interface DealLine {
  cluster: DealCluster
  itemName: string
  category: string | null
  storeName: string
  outOfStock: boolean
  meets: boolean | null
}

const columnHelper = createColumnHelper<DealLine>()
const pageSize = 20
const filters: { value: StatusFilter; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'bought', label: 'Bought' },
  { value: 'dismissed', label: 'Dismissed' },
  { value: 'expired', label: 'Expired' },
  { value: 'all', label: 'All' },
]

export function DealsPage() {
  useDocumentTitle('Deals')
  const catalog = useCatalog()
  const canEdit = useCanEdit()
  const push = useToast()
  const [params, setParams] = useSearchParams()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const status = parseStatusFilter(params.get('status'))
  const query = (params.get('q') ?? '').trim().toLowerCase()
  const category = params.get('category')
  const storeId = params.get('store')
  const stock = params.get('stock')
  const fit = params.get('fit')
  const verdict = params.get('verdict')
  const density = params.get('density') === 'compact' ? 'compact' : 'comfortable'
  const page = positiveInt(params.get('page'))
  const sorting = useMemo<SortingState>(() => [{
    id: params.get('col') || 'verdict',
    desc: params.get('dir') === 'desc',
  }], [params])

  const lines = useMemo(() => {
    const selected = catalog.deals.filter((deal) => status === 'all' || deal.status === status)
    return clusterDeals(selected, catalog.snapshots).map((cluster) => {
      const item = catalog.items.find((entry) => entry.id === cluster.deal.item_id)
      const linked = cluster.deal.snapshot_id == null
        ? null
        : catalog.snapshots.find((snapshot) => snapshot.id === cluster.deal.snapshot_id) ?? null
      return {
        cluster,
        itemName: item?.name ?? 'Unknown item',
        category: item?.category ?? null,
        storeName: catalog.stores.find((store) => store.id === cluster.deal.store_id)?.name ?? 'Unknown store',
        outOfStock: latestDealStock(cluster.deal, catalog.snapshots) === false,
        meets: linked?.meets_requirements ?? null,
      }
    }).filter((line) => {
      if (category && line.category !== category) return false
      if (storeId && line.cluster.deal.store_id !== storeId) return false
      if (stock === 'in' && line.outOfStock) return false
      if (stock === 'out' && !line.outOfStock) return false
      if (fit === 'yes' && line.meets !== true) return false
      if (fit === 'no' && line.meets !== false) return false
      if (verdict && verdictGroup(line.cluster.deal.verdict) !== verdict) return false
      if (!query) return true
      const haystack = `${line.itemName} ${line.storeName} ${line.cluster.deal.title} ${line.category ?? ''}`.toLowerCase()
      return query.split(/\s+/).every((token) => haystack.includes(token))
    })
  }, [catalog.deals, catalog.items, catalog.snapshots, catalog.stores, category, fit, query, status, stock, storeId, verdict])

  const openCount = useMemo(
    () => clusterDeals(catalog.deals.filter((deal) => deal.status === 'open'), catalog.snapshots).length,
    [catalog.deals, catalog.snapshots],
  )
  const categories = useMemo(
    () => [...new Set(catalog.items.map((item) => item.category).filter((entry): entry is string => Boolean(entry)))].sort((left, right) => left.localeCompare(right)),
    [catalog.items],
  )

  const mark = useCallback(async (deal: Deal, next: DealStatus) => {
    setPendingId(deal.id)
    try {
      await catalog.setDealStatus(deal.id, next)
      push('ok', dealMessage(next))
    } catch (error) {
      push('error', error instanceof Error ? error.message : 'Could not update the deal.')
    } finally {
      setPendingId(null)
    }
  }, [catalog, push])

  function update(updates: Record<string, string | null>, keepPage = false) {
    setParams(writeParams(params, keepPage ? updates : { ...updates, page: null }), { replace: true })
  }

  const columns = useMemo(() => dealColumns({
    canEdit,
    pendingId,
    onMark: (deal, next) => void mark(deal, next),
  }), [canEdit, mark, pendingId])

  if (!catalog.ready) return <LoadingBlock />
  if (catalog.error && catalog.deals.length === 0 && catalog.items.length === 0) {
    return <ErrorState message={catalog.error} onRetry={() => void catalog.refresh()} />
  }

  const stores = [...catalog.stores].sort((left, right) => left.name.localeCompare(right.name))

  return (
    <FadeIn>
      <div>
        <h1 className="font-display text-4xl">Deals</h1>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-muted">
          {openCount} open. Grouped by the checker’s verdict. Same model, different colour or finish, counts once.
          Must buy and good are the stronger marks. Prices here are the saved offer, before tax.
        </p>
        <div className="mt-5">
          <Segmented
            label="Deal status"
            value={status}
            options={filters}
            onChange={(value) => update({ status: value === 'open' ? null : value })}
          />
        </div>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
          <div className="grid flex-1 gap-3 lg:grid-cols-3">
            <input
              className="h-11 rounded-lg border border-line bg-paper-2 px-3 text-sm md:h-10"
              value={params.get('q') ?? ''}
              onChange={(event) => update({ q: event.target.value || null })}
              placeholder="Search deals"
              aria-label="Search deals"
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
              options={[{ value: 'all', label: 'Any fit' }, { value: 'yes', label: 'Meets specs' }, { value: 'no', label: 'Doesn’t meet specs' }]}
            />
            <Select
              label="Verdict"
              value={verdict ?? 'all'}
              onValueChange={(value) => update({ verdict: value === 'all' ? null : value })}
              options={[
                { value: 'all', label: 'Any verdict' },
                { value: 'must_buy', label: 'Must buy' },
                { value: 'good', label: 'Good' },
                { value: 'ok', label: 'OK' },
                { value: 'skip', label: 'Skip' },
                { value: 'unrated', label: 'Unrated' },
              ]}
            />
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
        <div className="mt-4">
          {catalog.deals.length === 0 ? (
            <EmptyState title="No deals yet" body="When a watched price is worth a look, it lands here with a verdict. Same model, different colour or finish, counts once." />
          ) : (
            <MarketTable
              data={lines}
                columns={columns}
              getRowId={(line) => line.cluster.deal.id}
              sorting={sorting}
              onSortingChange={(next) => {
                const first = next[0]
                update({
                  col: !first || (first.id === 'verdict' && !first.desc) ? null : first.id,
                  dir: first?.desc ? 'desc' : null,
                })
              }}
              page={page}
              pageSize={pageSize}
              onPageChange={(next) => update({ page: next <= 1 ? null : String(next) }, true)}
              density={density}
              caption="Deals"
              empty={<EmptyState title="No deals match" body="Clear a filter or try another status. Open deals are the ones still waiting." />}
              renderCard={(line) => (
                <DealCard
                  line={line}
                  pending={pendingId === line.cluster.deal.id}
                  canEdit={canEdit}
                  onMark={(next) => void mark(line.cluster.deal, next)}
                />
              )}
            />
          )}
        </div>
      </div>
    </FadeIn>
  )
}

function dealColumns({
  canEdit,
  pendingId,
  onMark,
}: {
  canEdit: boolean
  pendingId: string | null
  onMark: (deal: Deal, status: DealStatus) => void
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const columns: ColumnDef<DealLine, any>[] = [
    columnHelper.accessor((line) => verdictRank(verdictGroup(line.cluster.deal.verdict)), {
      id: 'verdict',
      header: 'Verdict',
      cell: ({ row }) => <Badge className={verdictTone(verdictGroup(row.original.cluster.deal.verdict))}>{verdictLabel(verdictGroup(row.original.cluster.deal.verdict))}</Badge>,
    }),
    columnHelper.accessor((line) => line.itemName, {
      id: 'item',
      header: 'Item',
      cell: ({ row }) => (
        <div>
          <Link className="font-medium hover:text-pine" to={`/items/${row.original.cluster.deal.item_id}`}>{row.original.itemName}</Link>
          <span className="mt-1 block text-xs text-muted">{row.original.cluster.deal.title}</span>
        </div>
      ),
    }),
    columnHelper.accessor((line) => categoryLabel(line.category), {
      id: 'category',
      header: 'Category',
      cell: ({ getValue }) => getValue(),
    }),
    columnHelper.accessor((line) => line.storeName, {
      id: 'store',
      header: 'Store',
      cell: ({ getValue }) => getValue(),
    }),
    columnHelper.accessor((line) => line.cluster.deal.price, {
      id: 'price',
      header: 'Price',
      cell: ({ row }) => {
        const deal = row.original.cluster.deal
        const discount = discountPercent(deal.price, deal.regular_price)
        return (
          <span className="tabular-nums">
            {formatCad(deal.price)}
            {discount != null && discount > 0 ? <span className="ml-1 text-xs text-muted">{discount.toFixed(0)}% off</span> : null}
          </span>
        )
      },
    }),
    columnHelper.accessor((line) => (line.outOfStock ? 1 : 0), {
      id: 'stock',
      header: 'Stock',
      cell: ({ row }) => row.original.outOfStock
        ? <Badge className="bg-skip-soft text-skip">Out of stock</Badge>
        : <Badge className="bg-pine-soft text-pine">In stock</Badge>,
    }),
    columnHelper.accessor((line) => line.meets === true ? 0 : line.meets === false ? 1 : 2, {
      id: 'fit',
      header: 'Fit',
      cell: ({ row }) => row.original.meets === true ? 'Meets specs' : row.original.meets === false ? 'Doesn’t meet specs' : '—',
    }),
    columnHelper.accessor((line) => line.cluster.deal.found_at, {
      id: 'found',
      header: 'Found',
      cell: ({ row }) => <RelativeTime iso={row.original.cluster.deal.found_at} />,
    }),
    columnHelper.accessor((line) => line.cluster.deal.status, {
      id: 'status',
      header: 'Status',
      cell: ({ getValue }) => statusLabel(getValue()),
    }),
  ]
  columns.push(columnHelper.display({
    id: 'link',
    header: 'Listing',
    enableSorting: false,
    cell: ({ row }) => {
      const href = safeHttpUrl(row.original.cluster.deal.url)
      const deal = row.original.cluster.deal
      return (
        <div className="flex flex-wrap gap-2">
          {href ? <a className="text-pine underline" href={href} target="_blank" rel="noopener noreferrer">Open</a> : <span className="text-muted">—</span>}
          {canEdit && deal.status === 'open' ? (
            <>
              <Button size="sm" disabled={pendingId === deal.id} onClick={() => onMark(deal, 'bought')}>Bought</Button>
              <Button size="sm" variant="secondary" disabled={pendingId === deal.id} onClick={() => onMark(deal, 'dismissed')}>Dismiss</Button>
            </>
          ) : null}
          {canEdit && deal.status !== 'open' ? (
            <Button size="sm" variant="secondary" disabled={pendingId === deal.id} onClick={() => onMark(deal, 'open')}>Reopen</Button>
          ) : null}
        </div>
      )
    },
  }))
  return columns
}

function DealCard({
  line,
  pending,
  canEdit,
  onMark,
}: {
  line: DealLine
  pending: boolean
  canEdit: boolean
  onMark: (status: DealStatus) => void
}) {
  const deal = line.cluster.deal
  const href = safeHttpUrl(deal.url)
  const pastExpiry = deal.expires_at != null && Date.parse(deal.expires_at) < Date.now() && deal.status === 'open'
  return (
    <article className="rounded-xl border border-line bg-paper-2 p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap gap-2">
            <Badge className={verdictTone(verdictGroup(deal.verdict))}>{verdictLabel(verdictGroup(deal.verdict))}</Badge>
            <Badge className="bg-paper text-muted">{statusLabel(deal.status)}</Badge>
            {line.outOfStock ? <Badge className="bg-skip-soft text-skip">Out of stock</Badge> : null}
          </div>
          <h3 className="mt-2 font-display text-2xl">{deal.title}</h3>
          <p className="mt-1 text-sm text-muted">
            <Link className="underline" to={`/items/${deal.item_id}`}>{line.itemName}</Link>
            {' · '}{line.storeName}
            {line.category ? ` · ${categoryLabel(line.category)}` : ''}
          </p>
        </div>
        <p className="font-mono text-2xl tabular-nums">{formatCad(deal.price)}</p>
      </div>
      <p className="mt-2 text-sm text-muted">
        <RelativeTime iso={deal.found_at} />
        {deal.expires_at ? ` · ${pastExpiry ? 'Past the listed expiry' : `Expires ${formatDay(deal.expires_at)}`}` : ''}
      </p>
      {canEdit && deal.reason ? <p className="mt-2 text-sm leading-6">{deal.reason}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {href ? <a className="text-sm text-pine underline" href={href} target="_blank" rel="noopener noreferrer">Open listing</a> : null}
        {canEdit && deal.status === 'open' ? (
          <>
            <Button size="sm" disabled={pending} onClick={() => onMark('bought')}>Mark bought</Button>
            <Button size="sm" variant="secondary" disabled={pending} onClick={() => onMark('dismissed')}>Dismiss</Button>
          </>
        ) : null}
        {canEdit && deal.status !== 'open' ? (
          <Button size="sm" variant="secondary" disabled={pending} onClick={() => onMark('open')}>Reopen</Button>
        ) : null}
      </div>
    </article>
  )
}

function verdictRank(verdict: ReturnType<typeof verdictGroup>): number {
  switch (verdict) {
    case 'must_buy':
      return 0
    case 'good':
      return 1
    case 'ok':
      return 2
    case 'skip':
      return 3
    case 'unrated':
      return 4
    default: {
      const neverVerdict: never = verdict
      return neverVerdict
    }
  }
}

function dealMessage(status: DealStatus): string {
  switch (status) {
    case 'bought':
      return 'Marked as bought.'
    case 'dismissed':
      return 'Deal dismissed.'
    case 'open':
      return 'Deal reopened.'
    case 'expired':
      return 'Deal marked expired.'
    default: {
      const neverStatus: never = status
      return neverStatus
    }
  }
}

function positiveInt(value: string | null): number {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1
}
