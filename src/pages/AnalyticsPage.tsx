import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useCanEdit } from '../auth/AuthProvider'
import {
  DealFlowChart,
  DiscountChart,
  IndexChart,
  SavingsChart,
  ScoreChart,
  StoreTrendChart,
  WinsChart,
} from '../components/charts'
import { FadeIn } from '../components/motion'
import { EmptyState, ErrorState, LoadingBlock, Segmented, Select } from '../components/ui'
import { computeAnalytics } from '../domain/analytics'
import { parsePresetParam } from '../domain/filters'
import { formatAxisDay, formatCad, formatDay, formatPct } from '../domain/format'
import { categoryLabel, presetLabel, statusLabel } from '../domain/labels'
import type { DatePreset, DealStatus } from '../domain/types'
import { watchCategories } from '../domain/watchlist'
import { writeParams } from '../lib/search'
import { useDocumentTitle } from '../lib/title'
import { useCatalog } from '../state/catalog'

const presets: DatePreset[] = ['30d', '90d', '365d', 'all']
const statuses: DealStatus[] = ['open', 'bought', 'dismissed', 'expired']

export function AnalyticsPage() {
  useDocumentTitle('Analytics')
  const catalog = useCatalog()
  const canEdit = useCanEdit()
  const [params, setParams] = useSearchParams()
  const preset = parsePresetParam(params.get('range'))
  const category = params.get('category')
  const storeId = params.get('store')
  const model = useMemo(
    () => computeAnalytics(catalog, { preset, category, storeId, includeTargets: canEdit }),
    [catalog, preset, category, storeId, canEdit],
  )
  const categories = watchCategories(catalog.items)

  function update(updates: Record<string, string | null>) {
    setParams(writeParams(params, updates), { replace: true })
  }

  if (!catalog.ready) return <LoadingBlock label="Adding up the ledger…" />
  if (catalog.error && catalog.items.length === 0) {
    return <ErrorState message={catalog.error} onRetry={() => void catalog.refresh()} />
  }

  const wins = model.storeStats.filter((store) => store.wins > 0)
  const discounts = model.storeStats.filter((store) => store.avgDiscountPct != null && store.observations > 0)

  return (
    <FadeIn>
    <div>
      <h1 className="font-display text-4xl">Analytics</h1>
      <p className="mt-3 max-w-3xl text-base leading-7">{model.insight}</p>
      <ul className="mt-3 grid max-w-3xl gap-1 text-sm leading-6 text-muted">
        <li>{model.atLowCount} priced {model.atLowCount === 1 ? 'item is' : 'items are'} at an all-time low.</li>
        <li>{model.openDealCount > 0 ? `${model.openDealCount} deals are still open.` : 'No deals are open right now.'}</li>
        <li>{model.pricedItemCount} of {model.itemCount} items in this filter have a saved price.</li>
      </ul>
      <ul className="mt-3 flex flex-wrap gap-2 text-xs" aria-label="Colour meanings">
        <li className="rounded-md bg-buy px-2 py-1 text-on-buy">Buy and price drops</li>
        <li className="rounded-md bg-wait-soft px-2 py-1 text-wait">Wait</li>
        <li className="rounded-md bg-skip-soft px-2 py-1 text-skip">Skip and price rises</li>
        <li className="rounded-md bg-good-soft px-2 py-1 text-good">Good offer</li>
      </ul>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Segmented
          label="Date range"
          value={preset}
          onChange={(range) => update({ range: range === '90d' ? null : range })}
          options={presets.map((value) => ({ value, label: presetLabel(value) }))}
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
          options={[
            { value: 'all', label: 'All stores' },
            ...[...catalog.stores].sort((left, right) => left.name.localeCompare(right.name)).map((store) => ({
              value: store.id,
              label: store.enabled ? store.name : `${store.name} (disabled)`,
            })),
          ]}
        />
      </div>
      {model.excludedCurrencyCount > 0 ? (
        <p className="mt-3 text-sm text-muted">
          {model.excludedCurrencyCount} snapshot{model.excludedCurrencyCount === 1 ? '' : 's'} in another currency {model.excludedCurrencyCount === 1 ? 'is' : 'are'} left out of the totals.
        </p>
      ) : null}

      {model.itemCount === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="The ledger is empty"
            body={canEdit ? 'Add a watchlist item first. Charts stay quiet until there is something to price.' : 'Charts stay quiet until there is something to price.'}
            action={<Link className="text-pine underline" to="/">Go to the watchlist</Link>}
          />
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi label="Watching" value={String(model.activeItemCount)} detail={`${model.itemCount} in this filter · ${model.pricedItemCount} with a price`} />
            {canEdit ? <Kpi label="Under target" value={formatCad(model.underTargetSavings)} detail={model.underTargetCount > 0 ? `${model.underTargetCount} items, at the current best in-stock price` : 'Nothing is under target right now'} /> : null}
            <Kpi label="Vs regular" value={formatCad(model.regularSavings)} detail="Gap between the current best price and that listing’s regular price" />
            <Kpi label="All-time lows" value={String(model.atLowCount)} detail={`${model.openDealCount} deals open now · ${model.dealsInPeriod} found in this period`} />
          </div>

          <section className="mt-8 rounded-xl border border-line bg-paper-2 shadow-sm p-4 md:p-5">
            <h2 className="font-display text-2xl">Price index</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-muted">
              Each item starts at 100 on the first day it has a price in {model.periodLabel}. Later days use that item’s lowest price, carried forward when a store does not report. The line is the average of those indexes. 100 is the dashed line.
            </p>
            {model.priceIndex.length < 2 ? (
              <ChartEmpty periodCount={model.periodSnapshotCount} historyCount={model.historySnapshotCount} />
            ) : (
              <div className="mt-4">
                <IndexChart points={model.priceIndex} />
                <details className="mt-3 text-sm">
                  <summary className="cursor-pointer text-muted">Daily index numbers</summary>
                  <div className="mt-2 max-h-48 overflow-auto">
                    <table className="w-full text-left">
                      <thead><tr><th className="py-1 font-medium">Day</th><th className="py-1 font-medium">Index</th></tr></thead>
                      <tbody>
                        {model.priceIndex.map((point) => (
                          <tr key={point.date} className="border-t border-line">
                            <td className="py-1">{formatAxisDay(point.date)}</td>
                            <td className="py-1 tabular-nums">{point.index.toFixed(1)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              </div>
            )}
          </section>

          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <section className="rounded-xl border border-line bg-paper-2 shadow-sm p-4 md:p-5">
              <h2 className="font-display text-2xl">Index by store</h2>
              <p className="mt-1 text-sm leading-6 text-muted">The same 100-based index, averaged only across items seen at that store.</p>
              {model.storeIndex.length === 0 ? <ChartEmpty periodCount={model.periodSnapshotCount} historyCount={model.historySnapshotCount} /> : <div className="mt-4"><StoreTrendChart series={model.storeIndex} /></div>}
            </section>
            <section className="rounded-xl border border-line bg-paper-2 shadow-sm p-4 md:p-5">
              <h2 className="font-display text-2xl">Savings vs regular</h2>
              <p className="mt-1 text-sm leading-6 text-muted">Each day, the gap between the cheapest observed price and its regular price, summed across items.</p>
              {model.savingsByDate.every((point) => point.savings === 0) ? <ChartEmpty periodCount={model.periodSnapshotCount} historyCount={model.historySnapshotCount} /> : <div className="mt-4"><SavingsChart points={model.savingsByDate} /></div>}
            </section>
          </div>

          <section className="mt-4 rounded-xl border border-line bg-paper-2 shadow-sm p-4 md:p-5">
            <h2 className="font-display text-2xl">Which store is cheapest</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-muted">
              For every item and every day in {model.periodLabel}, the store with the lowest CAD price wins. Ties go to the store name that comes first alphabetically. That is {model.itemDays} item-days.
            </p>
            {wins.length === 0 ? <ChartEmpty periodCount={model.periodSnapshotCount} historyCount={model.historySnapshotCount} /> : <div className="mt-4"><WinsChart rows={wins} /></div>}
            <details className="mt-4">
              <summary className="cursor-pointer text-sm text-muted">Store numbers</summary>
            <div className="mt-4 overflow-auto">
              <table className="w-full min-w-[36rem] text-left text-sm">
                <caption className="sr-only">Store comparison</caption>
                <thead className="text-muted">
                  <tr>
                    <th className="py-2 font-medium">Store</th>
                    <th className="py-2 font-medium">Cheapest days</th>
                    <th className="py-2 font-medium">Observations</th>
                    <th className="py-2 font-medium">Avg discount</th>
                  </tr>
                </thead>
                <tbody>
                  {model.storeStats.map((store) => (
                    <tr key={store.storeId} className="border-t border-line">
                      <td className="py-2">{store.storeName}{store.enabled ? '' : ' · disabled'}</td>
                      <td className="py-2 tabular-nums">{store.wins}</td>
                      <td className="py-2 tabular-nums">{store.observations}</td>
                      <td className="py-2 tabular-nums">{formatPct(store.avgDiscountPct, 1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </details>
          </section>

          <section className="mt-4 rounded-xl border border-line bg-paper-2 shadow-sm p-4 md:p-5">
            <h2 className="font-display text-2xl">Average discount by store</h2>
            <p className="mt-1 text-sm leading-6 text-muted">Mean of (regular − price) / regular for snapshots that include a regular price. A negative number means the price sat above regular.</p>
            {discounts.length === 0 ? <ChartEmpty periodCount={model.periodSnapshotCount} historyCount={model.historySnapshotCount} /> : <div className="mt-4"><DiscountChart rows={discounts.flatMap((store) => store.avgDiscountPct == null ? [] : [{ storeName: store.storeName, avgDiscountPct: store.avgDiscountPct }])} /></div>}
          </section>

          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <section className="rounded-xl border border-line bg-paper-2 shadow-sm p-4 md:p-5">
              <h2 className="font-display text-2xl">Deals over time</h2>
              <p className="mt-1 text-sm text-muted">
                Found in {model.periodLabel}, bucketed by {model.dealFlowGrain}. {statuses.map((status) => `${statusLabel(status)} ${model.statusTotals[status]}`).join(' · ')}
              </p>
              {model.dealFlow.length === 0 ? (
                <p className="mt-6 text-sm text-muted">No deals were found in this period.</p>
              ) : (
                <div className="mt-4"><DealFlowChart rows={model.dealFlow} /></div>
              )}
            </section>
            <section className="rounded-xl border border-line bg-paper-2 shadow-sm p-4 md:p-5">
              <h2 className="font-display text-2xl">Score distribution</h2>
              <p className="mt-1 text-sm text-muted">
                Scores run from 0 to 100. {model.unscoredDeals > 0 ? `${model.unscoredDeals} deals in this period have no score.` : 'Every deal in this period has a score.'}
              </p>
              {model.dealsInPeriod === 0 ? <p className="mt-6 text-sm text-muted">No deals were found in this period.</p> : <div className="mt-4"><ScoreChart rows={model.scoreBuckets} /></div>}
            </section>
          </div>

          <details className="mt-4 rounded-xl border border-line bg-paper-2 p-4 shadow-sm md:p-5">
            <summary className="cursor-pointer font-display text-2xl">Category and all-time-low tables</summary>
            <section className="mt-4">
            <h2 className="font-display text-2xl">Categories</h2>
            <p className="mt-1 text-sm text-muted">Current prices, ignoring the date range. Open deals are the ones still waiting.</p>
            <div className="mt-4 overflow-auto">
              <table className="w-full min-w-[36rem] text-left text-sm">
                <thead className="text-muted">
                  <tr>
                    <th className="py-2 font-medium">Category</th>
                    <th className="py-2 font-medium">Items</th>
                    {canEdit ? <th className="py-2 font-medium">Under target</th> : null}
                    <th className="py-2 font-medium">Open deals</th>
                    <th className="py-2 font-medium">Avg discount now</th>
                  </tr>
                </thead>
                <tbody>
                  {model.categories.map((entry) => (
                    <tr key={entry.category} className="border-t border-line">
                      <td className="py-2">{categoryLabel(entry.category)}</td>
                      <td className="py-2 tabular-nums">{entry.items}</td>
                      {canEdit ? <td className="py-2 tabular-nums">{entry.underTarget}</td> : null}
                      <td className="py-2 tabular-nums">{entry.openDeals}</td>
                      <td className="py-2 tabular-nums">{formatPct(entry.avgDiscountPct, 1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-4 rounded-xl border border-line bg-paper-2 shadow-sm p-4 md:p-5">
            <h2 className="font-display text-2xl">All-time lows</h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              The lowest CAD price ever saved for each item in this category and store filter. The date range does not move the low. “Now” is the latest in-stock price.
            </p>
            {model.allTimeLows.length === 0 ? (
              <p className="mt-6 text-sm text-muted">No CAD prices yet, so there is no low to track.</p>
            ) : (
              <div className="mt-4 overflow-auto">
                <table className="w-full min-w-[44rem] text-left text-sm">
                  <caption className="sr-only">All-time lows</caption>
                  <thead className="text-muted">
                    <tr>
                      <th className="py-2 font-medium">Item</th>
                      <th className="py-2 font-medium">Low</th>
                      <th className="py-2 font-medium">When</th>
                      <th className="py-2 font-medium">Now</th>
                      <th className="py-2 font-medium">Gap</th>
                    </tr>
                  </thead>
                  <tbody>
                    {model.allTimeLows.map((row) => (
                      <tr key={row.itemId} className="border-t border-line">
                        <td className="py-2">
                          <Link className="underline" to={`/items/${row.itemId}`}>{row.itemName}</Link>
                          <span className="block text-xs text-muted">{categoryLabel(row.category)}</span>
                        </td>
                        <td className="py-2 tabular-nums">{formatCad(row.atlPrice)}<span className="block text-xs text-muted">{row.atlStoreName}</span></td>
                        <td className="py-2">{formatDay(row.atlAt)}</td>
                        <td className="py-2 tabular-nums">{row.currentPrice != null ? formatCad(row.currentPrice) : '—'}{row.atLow ? <span className="block text-xs text-pine">At the low</span> : null}</td>
                        <td className="py-2 tabular-nums">{row.gap == null ? '—' : formatCad(row.gap)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          </details>
        </>
      )}
    </div>
    </FadeIn>
  )
}

function Kpi({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className="rounded-xl border border-line bg-paper-2 shadow-sm p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 font-mono text-2xl font-medium tracking-tight tabular-nums">{value}</p>
      <p className="mt-1 text-sm leading-5 text-muted">{detail}</p>
    </article>
  )
}

function ChartEmpty({ periodCount, historyCount }: { periodCount: number; historyCount: number }) {
  const body = periodCount === 0 && historyCount > 0
    ? 'Nothing was captured in this range. Widen the dates to see older prices.'
    : 'This chart needs prices from the daily check. It will fill in once snapshots arrive.'
  return <p className="mt-6 rounded-2xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted">{body}</p>
}
