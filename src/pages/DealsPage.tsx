import { useMemo, useState } from 'react'
import { FadeIn, MotionCard } from '../components/motion'
import { Link, useSearchParams } from 'react-router-dom'
import { useCanEdit } from '../auth/AuthProvider'
import { useToast } from '../components/toast'
import { Badge, Button, EmptyState, ErrorState, LoadingBlock, Segmented } from '../components/ui'
import { clusterDeals, groupDeals, verdictGroup } from '../domain/deals'
import type { DealCluster } from '../domain/deals'
import { parseStatusFilter } from '../domain/filters'
import type { StatusFilter } from '../domain/filters'
import { discountPercent, formatCad, formatDay, formatRelative, safeHttpUrl } from '../domain/format'
import { statusLabel, verdictLabel, verdictTone } from '../domain/labels'
import type { Deal, DealStatus } from '../domain/types'
import { writeParams } from '../lib/search'
import { useDocumentTitle } from '../lib/title'
import { useCatalog } from '../state/catalog'

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
  const clusters = useMemo(() => {
    const selected = catalog.deals.filter((deal) => status === 'all' || deal.status === status)
    return clusterDeals(selected, catalog.snapshots)
  }, [catalog.deals, catalog.snapshots, status])
  const visible = useMemo(() => {
    const byId = new Map(clusters.map((cluster) => [cluster.deal.id, cluster]))
    return groupDeals(clusters.map((cluster) => cluster.deal)).map((group) => ({
      verdict: group.verdict,
      clusters: group.deals.map((deal) => byId.get(deal.id)).filter((cluster): cluster is DealCluster => cluster != null),
    }))
  }, [clusters])
  const openCount = useMemo(
    () => clusterDeals(catalog.deals.filter((deal) => deal.status === 'open'), catalog.snapshots).length,
    [catalog.deals, catalog.snapshots],
  )

  async function mark(deal: Deal, next: DealStatus) {
    setPendingId(deal.id)
    try {
      await catalog.setDealStatus(deal.id, next)
      push('ok', dealMessage(next))
    } catch (error) {
      push('error', error instanceof Error ? error.message : 'Could not update the deal.')
    } finally {
      setPendingId(null)
    }
  }

  if (!catalog.ready) return <LoadingBlock />
  if (catalog.error && catalog.deals.length === 0 && catalog.items.length === 0) {
    return <ErrorState message={catalog.error} onRetry={() => void catalog.refresh()} />
  }

  return (
    <FadeIn>
    <div>
      <h1 className="font-display text-4xl">Deals</h1>
      <p className="mt-1 max-w-3xl text-sm leading-6 text-muted">
        {openCount} open. Grouped by the checker’s verdict. Same model, different colour or finish, counts once.
        Must buy and good are the stronger marks. Skip was scored and set aside. Prices here are the saved offer, before tax.
      </p>
      <div className="mt-5">
        <Segmented
          label="Deal status"
          value={status}
          options={filters}
          onChange={(value) => setParams(writeParams(params, { status: value === 'open' ? null : value }), { replace: true })}
        />
      </div>
      {catalog.deals.length === 0 ? (
        <div className="mt-8">
          <EmptyState title="No deals yet" body="When a watched price is worth a look, it lands here with a verdict. Same model, different colour or finish, counts once." />
        </div>
      ) : visible.length === 0 ? (
        <div className="mt-8">
          <EmptyState title={`No ${statusLabel(status === 'all' ? 'open' : status).toLowerCase()} deals`} body="Try another status. Open deals are the ones still waiting on you." />
        </div>
      ) : (
        <div className="mt-8 grid gap-8">
          {visible.map((group) => (
            <section key={group.verdict}>
              <h2 className="font-display text-2xl">{verdictLabel(group.verdict)} <span className="text-muted">{group.clusters.length}</span></h2>
              <div className="mt-3 grid gap-3">
                {group.clusters.map((cluster, index) => (
                  <MotionCard key={cluster.deal.id} index={index}>
                  <DealCard
                    deal={cluster.deal}
                    options={cluster.options}
                    itemName={catalog.items.find((item) => item.id === cluster.deal.item_id)?.name ?? 'Unknown item'}
                    storeName={catalog.stores.find((store) => store.id === cluster.deal.store_id)?.name ?? 'Unknown store'}
                    pending={pendingId === cluster.deal.id}
                    canEdit={canEdit}
                    onMark={(next) => void mark(cluster.deal, next)}
                  />
                  </MotionCard>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
    </FadeIn>
  )
}

function DealCard({
  deal,
  options,
  itemName,
  storeName,
  pending,
  canEdit,
  onMark,
}: {
  deal: Deal
  options: DealCluster['options']
  itemName: string
  storeName: string
  pending: boolean
  canEdit: boolean
  onMark: (status: DealStatus) => void
}) {
  const href = safeHttpUrl(deal.url)
  const discount = discountPercent(deal.price, deal.regular_price)
  const pastExpiry = deal.expires_at != null && Date.parse(deal.expires_at) < Date.now() && deal.status === 'open'
  return (
    <article className="rounded-xl border border-line bg-paper-2 shadow-sm p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={verdictTone(verdictGroup(deal.verdict))}>{verdictLabel(verdictGroup(deal.verdict))}</Badge>
            <Badge className="bg-paper text-muted">{statusLabel(deal.status)}</Badge>
            {deal.score != null ? <span className="text-sm tabular-nums text-muted">Score {deal.score}</span> : null}
          </div>
          <h3 className="mt-2 font-display text-2xl">{deal.title}</h3>
          <p className="mt-1 text-sm text-muted">
            <Link className="underline" to={`/items/${deal.item_id}`}>{itemName}</Link>
            {' · '}{storeName}
            {' · '}{formatRelative(deal.found_at)}
          </p>
        </div>
        <div>
          <p className="font-mono text-3xl font-medium tracking-tight tabular-nums">{formatCad(deal.price)}</p>
          {deal.regular_price != null ? (
            <p className="text-sm text-muted">
              <s>{formatCad(deal.regular_price)}</s>
              {discount != null ? ` · ${discount.toFixed(0)}%` : ''}
            </p>
          ) : null}
        </div>
      </div>
      {deal.score != null ? (
        <div className="mt-3 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-line" aria-hidden="true">
          <div className="h-full bg-pine" style={{ width: `${deal.score}%` }} />
        </div>
      ) : null}
      {options.length > 1 ? (
        <ul className="mt-3 grid gap-1 text-sm">
          {options.map((option) => {
            const href = safeHttpUrl(option.url)
            return (
              <li key={`${option.label ?? 'option'}-${option.price}`} className="flex flex-wrap items-baseline gap-x-2">
                <span>{option.label ?? 'Option'}</span>
                <span className="tabular-nums">{formatCad(option.price)}</span>
                {href ? <a className="text-pine underline" href={href} target="_blank" rel="noopener noreferrer">Open listing</a> : null}
              </li>
            )
          })}
        </ul>
      ) : null}
      {canEdit && deal.reason ? <p className="mt-3 max-w-2xl text-sm leading-6">{deal.reason}</p> : null}
      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted">
        {deal.notified_at ? <span>Notified {formatRelative(deal.notified_at)}</span> : null}
        {deal.expires_at ? <span>{pastExpiry ? 'Past the listed expiry' : `Expires ${formatDay(deal.expires_at)}`}</span> : null}
        {href ? <a className="text-pine underline" href={href} target="_blank" rel="noopener noreferrer">Open listing</a> : null}
      </div>
      {canEdit ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {deal.status === 'open' ? (
            <>
              <Button size="sm" disabled={pending} onClick={() => onMark('bought')}>Mark bought</Button>
              <Button size="sm" variant="secondary" disabled={pending} onClick={() => onMark('dismissed')}>Dismiss</Button>
            </>
          ) : (
            <Button size="sm" variant="secondary" disabled={pending} onClick={() => onMark('open')}>Reopen</Button>
          )}
        </div>
      ) : null}
    </article>
  )
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
