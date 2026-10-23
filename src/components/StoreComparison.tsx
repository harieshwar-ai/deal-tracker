import { useState } from 'react'
import { formatCad, formatDay, safeHttpUrl } from '../domain/format'
import { saleCountdown } from '../domain/compare'
import type { StoreComparison as StoreOffer } from '../domain/compare'
import { MotionCard } from './motion'
import { VariantPicker } from './OfferVariants'
import { StoreMark } from './product'

export function StoreComparison({ offers, muted = false, now = new Date() }: { offers: StoreOffer[]; muted?: boolean; now?: Date }) {
  if (offers.length === 0) {
    return <p className="text-sm text-muted">No current store prices yet.</p>
  }
  return (
    <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {offers.map((offer, index) => (
        <StoreCard key={offer.snapshotId} offer={offer} index={index} muted={muted} now={now} />
      ))}
    </div>
  )
}

function StoreCard({ offer, index, muted, now }: { offer: StoreOffer; index: number; muted: boolean; now: Date }) {
  const choices = offer.variants.length > 1 ? offer.variants : []
  const [selectedId, setSelectedId] = useState(offer.snapshotId)
  const shown = offer.variants.find((variant) => variant.snapshotId === selectedId) ?? offer.variants.find((variant) => variant.best) ?? null
  const price = shown?.price ?? offer.price
  const tax = shown?.tax ?? offer.tax
  const shipping = shown?.shipping ?? offer.shipping
  const shippingKnown = shown?.shippingKnown ?? offer.shippingKnown
  const total = shown?.total ?? offer.total
  const inStock = shown?.inStock ?? offer.inStock
  const saleEndsAt = shown?.saleEndsAt ?? offer.saleEndsAt
  const href = safeHttpUrl(shown?.productUrl ?? offer.productUrl)
  const countdown = saleCountdown(saleEndsAt, now)
  const highlighted = offer.bestPrice && !muted && (shown?.best ?? true)
  const tone = highlighted
    ? 'rounded-xl border border-pine bg-pine-soft p-4 shadow-sm'
    : muted
      ? 'rounded-xl border border-dashed border-line bg-paper p-4 text-muted'
      : 'rounded-xl border border-line bg-paper-2 p-4 shadow-sm'
  return (
    <MotionCard index={index} className={tone}>
      <div className="flex flex-wrap items-center gap-2">
        <StoreMark name={offer.storeName} />
        <h3 className="font-semibold">{offer.storeName}</h3>
        {highlighted ? <span className="text-xs text-pine">Lowest price</span> : null}
        {muted && offer.statusLabel ? <span className="text-xs">{offer.statusLabel}</span> : null}
      </div>
      {offer.productName ? <p className="mt-2 text-sm">{offer.productName}</p> : null}
      <p className="mt-3 font-mono text-2xl font-medium tracking-tight tabular-nums">{formatCad(price)}</p>
      {choices.length > 0 && offer.variantHeading ? (
        <VariantPicker heading={offer.variantHeading} variants={choices} selectedId={shown?.snapshotId ?? offer.snapshotId} onSelect={setSelectedId} />
      ) : null}
      <PriceBreakdown tax={tax} shipping={shipping} shippingKnown={shippingKnown} total={total} />
      <p className="mt-3 text-sm">{stockLabel(inStock)}</p>
      {saleEndsAt ? (
        <p className="mt-1 text-sm">
          Sale ends {formatDay(saleEndsAt)}
          {countdown ? ` · ${countdown}` : ''}
        </p>
      ) : (
        <p className="mt-1 text-sm text-muted">No sale end date</p>
      )}
      {href ? <a className="mt-3 inline-block text-sm text-pine underline" href={href} target="_blank" rel="noopener noreferrer">Open listing</a> : null}
    </MotionCard>
  )
}

function PriceBreakdown({ tax, shipping, shippingKnown, total }: { tax: number; shipping: number | null; shippingKnown: boolean; total: number }) {
  return (
    <dl className="mt-3 grid gap-1 text-sm">
      <div className="flex justify-between gap-3">
        <dt className="font-medium text-muted">HST 13%</dt>
        <dd className="tabular-nums">{formatCad(tax)}</dd>
      </div>
      <div className="flex justify-between gap-3">
        <dt className="font-medium text-muted">Shipping</dt>
        <dd>{shippingKnown ? formatCad(shipping) : 'Unknown'}</dd>
      </div>
      <div className="flex justify-between gap-3 font-semibold">
        <dt>{shippingKnown ? 'Tax-in total' : 'Tax-in, plus shipping'}</dt>
        <dd className="tabular-nums">{formatCad(total)}</dd>
      </div>
    </dl>
  )
}

function stockLabel(inStock: boolean | null): string {
  if (inStock == null) return 'Stock unknown'
  return inStock ? 'In stock' : 'Out of stock'
}
