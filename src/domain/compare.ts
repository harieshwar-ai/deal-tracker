import { roundMoney } from './format'
import { variantHeading } from './identity'
import type { VariantKind } from './identity'
import { requirementLabel } from './offers'
import type { OfferVariant, Quote } from './quotes'
import type { Deal } from './types'

export const ontarioHstRate = 0.13

export interface StoreComparison {
  snapshotId: number
  storeName: string
  price: number
  currency: string
  inStock: boolean | null
  shipping: number | null
  saleEndsAt: string | null
  productUrl: string | null
  productName: string | null
  statusLabel: string | null
  tax: number
  total: number
  shippingKnown: boolean
  bestPrice: boolean
  productLabel: string | null
  variantHeading: string | null
  variants: StoreVariant[]
}

export interface StoreVariant {
  snapshotId: number
  label: string | null
  kind: VariantKind | null
  price: number
  inStock: boolean | null
  shipping: number | null
  saleEndsAt: string | null
  productUrl: string | null
  productName: string | null
  tax: number
  total: number
  shippingKnown: boolean
  best: boolean
}

export function itemTax(price: number): number {
  return roundMoney(price * ontarioHstRate)
}

export function compareStores(quotes: Quote[], deals: Deal[], bestSnapshotId: number | null): StoreComparison[] {
  const rows = quotes.map((quote) => {
    const variants = pricedVariants(quote, deals)
    const headline = variants.find((variant) => variant.best) ?? variants[0]
    const shippingKnown = headline?.shippingKnown ?? false
    return {
      snapshotId: headline?.snapshotId ?? quote.snapshotId,
      storeName: quote.storeName,
      price: headline?.price ?? quote.price,
      currency: quote.currency,
      inStock: headline?.inStock ?? quote.inStock,
      shipping: headline?.shipping ?? quote.shipping,
      saleEndsAt: headline?.saleEndsAt ?? quote.saleEndsAt ?? openSaleEnd(deals, quote.storeId),
      productUrl: headline?.productUrl ?? quote.productUrl,
      productName: quote.productName,
      statusLabel: requirementLabel(quote.meetsRequirements),
      tax: headline?.tax ?? itemTax(quote.price),
      total: headline?.total ?? roundMoney(quote.price + itemTax(quote.price)),
      shippingKnown,
      bestPrice: (headline?.snapshotId ?? quote.snapshotId) === bestSnapshotId,
      productLabel: quote.productLabel ?? quote.productName,
      variantHeading: variants.length > 1 ? (quote.variantHeading ?? variantHeading(variants.map((variant) => variant.kind))) : null,
      variants,
    }
  })
  return rows.sort((left, right) => {
    const stock = stockRank(left.inStock) - stockRank(right.inStock)
    if (stock !== 0) return stock
    return left.total - right.total || left.storeName.localeCompare(right.storeName)
  })
}

export function saleCountdown(iso: string | null, now = new Date()): string | null {
  if (!iso) return null
  const end = Date.parse(iso)
  if (Number.isNaN(end)) return null
  const ms = end - now.getTime()
  if (ms <= 0) return 'Sale ended'
  const hours = Math.floor(ms / 3600000)
  if (hours < 48) return hours < 1 ? 'Under an hour left' : `${hours}h left`
  const days = Math.ceil(ms / 86400000)
  return `${days} days left`
}

function pricedVariants(quote: Quote, deals: Deal[]): StoreVariant[] {
  const source = quote.variants.length > 0 ? quote.variants : [fallbackVariant(quote)]
  return source.map((variant) => priceVariant(variant, quote, deals))
}

function fallbackVariant(quote: Quote): OfferVariant {
  return {
    snapshotId: quote.snapshotId,
    label: null,
    kind: null,
    price: quote.price,
    regularPrice: quote.regularPrice,
    currency: quote.currency,
    inStock: quote.inStock,
    memberOnly: quote.memberOnly,
    capturedAt: quote.capturedAt,
    productName: quote.productName,
    productUrl: quote.productUrl,
    saleEndsAt: quote.saleEndsAt,
    shipping: quote.shipping,
    meetsRequirements: quote.meetsRequirements,
    best: true,
  }
}

function priceVariant(variant: OfferVariant, quote: Quote, deals: Deal[]): StoreVariant {
  const shippingKnown = variant.shipping != null && Number.isFinite(variant.shipping)
  const shipping = shippingKnown ? variant.shipping : null
  const tax = itemTax(variant.price)
  return {
    snapshotId: variant.snapshotId,
    label: variant.label,
    kind: variant.kind,
    price: variant.price,
    inStock: variant.inStock,
    shipping,
    saleEndsAt: variant.saleEndsAt ?? quote.saleEndsAt ?? openSaleEnd(deals, quote.storeId),
    productUrl: variant.productUrl,
    productName: variant.productName,
    tax,
    total: roundMoney(variant.price + tax + (shipping ?? 0)),
    shippingKnown,
    best: variant.best,
  }
}

function openSaleEnd(deals: Deal[], storeId: string | null): string | null {
  let best: string | null = null
  for (const deal of deals) {
    if (deal.status !== 'open' || !deal.expires_at) continue
    if ((deal.store_id ?? null) !== storeId) continue
    if (!best || Date.parse(deal.expires_at) < Date.parse(best)) best = deal.expires_at
  }
  return best
}

function stockRank(inStock: boolean | null): number {
  if (inStock === false) return 1
  return 0
}
