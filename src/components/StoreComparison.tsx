import { formatCad, formatDay, safeHttpUrl } from '../domain/format'
import { saleCountdown } from '../domain/compare'
import type { StoreComparison as StoreOffer } from '../domain/compare'
import { StoreMark } from './product'

export function StoreComparison({ offers, now = new Date() }: { offers: StoreOffer[]; now?: Date }) {
  if (offers.length === 0) {
    return <p className="text-sm text-muted">No current store prices yet.</p>
  }
  return (
    <ul className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {offers.map((offer) => {
        const href = safeHttpUrl(offer.productUrl)
        const countdown = saleCountdown(offer.saleEndsAt, now)
        return (
          <li key={offer.snapshotId} className={offer.bestPrice ? 'rounded-3xl border border-pine bg-pine-soft p-4' : 'rounded-3xl border border-line bg-paper-2 p-4'}>
            <div className="flex items-center gap-2">
              <StoreMark name={offer.storeName} />
              <h3 className="font-semibold">{offer.storeName}</h3>
              {offer.bestPrice ? <span className="text-xs text-pine">Lowest price</span> : null}
            </div>
            <p className="mt-3 font-display text-3xl tabular-nums">{formatCad(offer.price)}</p>
            <dl className="mt-3 grid gap-1 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">HST 13%</dt>
                <dd className="tabular-nums">{formatCad(offer.tax)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Shipping</dt>
                <dd>{offer.shippingKnown ? formatCad(offer.shipping) : 'Unknown'}</dd>
              </div>
              <div className="flex justify-between gap-3 font-semibold">
                <dt>{offer.shippingKnown ? 'Tax-in total' : 'Tax-in, plus shipping'}</dt>
                <dd className="tabular-nums">{formatCad(offer.total)}</dd>
              </div>
            </dl>
            <p className="mt-3 text-sm">{offer.inStock == null ? 'Stock unknown' : offer.inStock ? 'In stock' : 'Out of stock'}</p>
            {offer.saleEndsAt ? (
              <p className="mt-1 text-sm">
                Sale ends {formatDay(offer.saleEndsAt)}
                {countdown ? ` · ${countdown}` : ''}
              </p>
            ) : (
              <p className="mt-1 text-sm text-muted">No sale end date</p>
            )}
            {href ? <a className="mt-3 inline-block text-sm text-pine underline" href={href} target="_blank" rel="noopener noreferrer">Open listing</a> : null}
          </li>
        )
      })}
    </ul>
  )
}
