import { roundMoney } from './format'
import type { Quote } from './quotes'
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
  tax: number
  total: number
  shippingKnown: boolean
  bestPrice: boolean
}

export function itemTax(price: number): number {
  return roundMoney(price * ontarioHstRate)
}

export function compareStores(quotes: Quote[], deals: Deal[], bestSnapshotId: number | null): StoreComparison[] {
  const rows = quotes.map((quote) => {
    const shippingKnown = quote.shipping != null && Number.isFinite(quote.shipping)
    const shipping = shippingKnown ? quote.shipping : null
    const tax = itemTax(quote.price)
    return {
      snapshotId: quote.snapshotId,
      storeName: quote.storeName,
      price: quote.price,
      currency: quote.currency,
      inStock: quote.inStock,
      shipping,
      saleEndsAt: quote.saleEndsAt ?? openSaleEnd(deals, quote.storeId),
      productUrl: quote.productUrl,
      tax,
      total: roundMoney(quote.price + tax + (shipping ?? 0)),
      shippingKnown,
      bestPrice: quote.snapshotId === bestSnapshotId,
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
