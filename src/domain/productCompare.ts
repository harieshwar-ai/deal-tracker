import { roundMoney } from './format'
import { assignProducts } from './identity'
import { isQualifying } from './offers'
import { cheapestEver, offerQuotes } from './quotes'
import { compareStores, itemTax } from './compare'
import type { StoreComparison } from './compare'
import type { Deal, PriceSnapshot, Store } from './types'
import type { Quote } from './quotes'

export type ChecklistState = 'meets' | 'misses' | 'unverified'
export type SortDirection = 'asc' | 'desc'
export type ProductSortKey = 'name' | 'total' | 'stock' | 'lowest' | 'meets'
export type StoreSortKey = 'store' | 'price' | 'total' | 'stock' | 'lowest' | 'meets'

export interface ProductStoreCell {
  storeId: string | null
  storeName: string
  price: number
  tax: number
  shipping: number | null
  shippingKnown: boolean
  total: number
  inStock: boolean | null
  meets: ChecklistState
  qualifying: boolean
  url: string | null
  capturedAt: string
  variantHeading: string | null
}

export interface ComparedProduct {
  key: string
  name: string
  meets: ChecklistState
  stock: boolean | null
  lowest: { price: number; at: string; storeName: string; outOfStock: boolean } | null
  cells: ProductStoreCell[]
  bestTotal: number | null
  best: boolean
}

export interface StoreTableRow extends StoreComparison {
  meets: ChecklistState
  capturedAt: string
  lowest: number | null
  lowestOutOfStock: boolean
  productKey: string
}

export function checklistLabel(state: ChecklistState): string {
  switch (state) {
    case 'meets':
      return 'Meets specs'
    case 'misses':
      return "Doesn't meet specs"
    case 'unverified':
      return 'Unverified'
    default: {
      const neverState: never = state
      return neverState
    }
  }
}

export function compareCandidateProducts(snapshots: PriceSnapshot[], stores: Store[]): ComparedProduct[] {
  const assignments = assignProducts(snapshots)
  const groups = new Map<string, PriceSnapshot[]>()
  for (const snapshot of snapshots) {
    const key = assignments.get(snapshot.id)?.productKey ?? `${snapshot.item_id}\u0000${snapshot.id}`
    const list = groups.get(key) ?? []
    list.push(snapshot)
    groups.set(key, list)
  }
  const products = [...groups.entries()].map(([key, members]) => buildProduct(key, members, assignments, stores))
  const winner = products
    .filter((product) => product.bestTotal != null)
    .sort((left, right) => (left.bestTotal ?? 0) - (right.bestTotal ?? 0) || left.name.localeCompare(right.name))[0]
  return products
    .map((product) => ({ ...product, best: winner != null && product.key === winner.key }))
    .sort((left, right) => compareNullable(left.bestTotal, right.bestTotal, 1) || left.name.localeCompare(right.name))
}

export function sortComparedProducts(products: ComparedProduct[], key: ProductSortKey, direction: SortDirection): ComparedProduct[] {
  const sign = direction === 'asc' ? 1 : -1
  return [...products].sort((left, right) => {
    const compared = compareProduct(left, right, key, sign)
    return compared || left.name.localeCompare(right.name)
  })
}

export function storeRowsFromQuotes(
  quotes: Quote[],
  deals: Deal[],
  snapshots: PriceSnapshot[],
  bestSnapshotId: number | null,
): StoreTableRow[] {
  const assignments = assignProducts(snapshots)
  return compareStores(quotes, deals, bestSnapshotId).map((row) => {
    const quote = quotes.find((entry) => entry.snapshotId === row.snapshotId || entry.variants.some((variant) => variant.snapshotId === row.snapshotId))
    const productKey = quote ? (assignments.get(quote.snapshotId)?.productKey ?? String(quote.snapshotId)) : String(row.snapshotId)
    const pool = snapshots.filter((snapshot) => {
      if (!isQualifying(snapshot)) return false
      if ((snapshot.store_id ?? null) !== (quote?.storeId ?? null)) return false
      return (assignments.get(snapshot.id)?.productKey ?? String(snapshot.id)) === productKey
    })
    const ever = cheapestEver(pool)
    return {
      ...row,
      meets: checklist(quote?.meetsRequirements ?? null),
      capturedAt: quote?.capturedAt ?? '',
      lowest: ever?.snapshot.price ?? null,
      lowestOutOfStock: ever?.outOfStock ?? false,
      productKey,
    }
  })
}

export function sortStoreRows(rows: StoreTableRow[], key: StoreSortKey, direction: SortDirection): StoreTableRow[] {
  const sign = direction === 'asc' ? 1 : -1
  return [...rows].sort((left, right) => compareStore(left, right, key, sign) || left.storeName.localeCompare(right.storeName))
}

export function storeNamesFor(products: ComparedProduct[]): string[] {
  const names = new Set<string>()
  for (const product of products) {
    for (const cell of product.cells) names.add(cell.storeName)
  }
  return [...names].sort((left, right) => left.localeCompare(right))
}

function buildProduct(
  key: string,
  members: PriceSnapshot[],
  assignments: ReturnType<typeof assignProducts>,
  stores: Store[],
): ComparedProduct {
  const qualifying = members.filter(isQualifying)
  const quotes = offerQuotes(qualifying, stores)
  const other = offerQuotes(members.filter((snapshot) => !isQualifying(snapshot)), stores)
  const byStore = new Map<string, ProductStoreCell>()
  for (const quote of other) byStore.set(quote.storeId ?? quote.storeName, cellFromQuote(quote, false))
  for (const quote of quotes) byStore.set(quote.storeId ?? quote.storeName, cellFromQuote(quote, true))
  const cells = [...byStore.values()].sort((left, right) => left.storeName.localeCompare(right.storeName))
  const purchasable = cells.filter((cell) => cell.qualifying && cell.inStock !== false)
  const bestTotal = purchasable.length > 0 ? Math.min(...purchasable.map((cell) => cell.total)) : null
  const ever = cheapestEver(qualifying)
  const named = members.map((snapshot) => assignments.get(snapshot.id)?.displayName).find((name) => name) ?? members.find((snapshot) => snapshot.product_name)?.product_name
  return {
    key,
    name: named?.trim() || 'Unnamed listing',
    meets: productMeets(quotes, other),
    stock: productStock(cells),
    lowest: ever
      ? {
          price: ever.snapshot.price,
          at: ever.snapshot.captured_at,
          storeName: stores.find((store) => store.id === ever.snapshot.store_id)?.name ?? 'Unknown store',
          outOfStock: ever.outOfStock,
        }
      : null,
    cells,
    bestTotal,
    best: false,
  }
}

function productStock(cells: ProductStoreCell[]): boolean | null {
  if (cells.some((cell) => cell.qualifying && cell.inStock === true)) return true
  if (cells.some((cell) => cell.qualifying && cell.inStock == null)) return null
  if (cells.some((cell) => cell.qualifying)) return false
  return cells[0]?.inStock ?? null
}

function productMeets(quotes: Quote[], other: Quote[]): ChecklistState {
  if (quotes.length > 0) return 'meets'
  if (other.some((quote) => quote.meetsRequirements === false)) return 'misses'
  return 'unverified'
}

function cellFromQuote(quote: Quote, qualifying: boolean): ProductStoreCell {
  const shippingKnown = quote.shipping != null && Number.isFinite(quote.shipping)
  const shipping = shippingKnown ? quote.shipping : null
  const tax = itemTax(quote.price)
  return {
    storeId: quote.storeId,
    storeName: quote.storeName,
    price: quote.price,
    tax,
    shipping,
    shippingKnown,
    total: roundMoney(quote.price + tax + (shipping ?? 0)),
    inStock: quote.inStock,
    meets: checklist(quote.meetsRequirements),
    qualifying,
    url: quote.productUrl,
    capturedAt: quote.capturedAt,
    variantHeading: quote.variantHeading,
  }
}

function checklist(value: boolean | null): ChecklistState {
  if (value === true) return 'meets'
  if (value === false) return 'misses'
  return 'unverified'
}

function compareProduct(left: ComparedProduct, right: ComparedProduct, key: ProductSortKey, sign: number): number {
  switch (key) {
    case 'name':
      return left.name.localeCompare(right.name) * sign
    case 'total':
      return compareNullable(left.bestTotal, right.bestTotal, sign)
    case 'stock':
      return (stockRank(left.stock) - stockRank(right.stock)) * sign
    case 'lowest':
      return compareNullable(left.lowest?.price ?? null, right.lowest?.price ?? null, sign)
    case 'meets':
      return (meetsRank(left.meets) - meetsRank(right.meets)) * sign
    default: {
      const neverKey: never = key
      return neverKey
    }
  }
}

function compareStore(left: StoreTableRow, right: StoreTableRow, key: StoreSortKey, sign: number): number {
  switch (key) {
    case 'store':
      return left.storeName.localeCompare(right.storeName) * sign
    case 'price':
      return (left.price - right.price) * sign
    case 'total':
      return (left.total - right.total) * sign
    case 'stock':
      return (stockRank(left.inStock) - stockRank(right.inStock)) * sign
    case 'lowest':
      return compareNullable(left.lowest, right.lowest, sign)
    case 'meets':
      return (meetsRank(left.meets) - meetsRank(right.meets)) * sign
    default: {
      const neverKey: never = key
      return neverKey
    }
  }
}

function compareNullable(left: number | null, right: number | null, sign: number): number {
  if (left == null && right == null) return 0
  if (left == null) return 1
  if (right == null) return -1
  return (left - right) * sign
}

function stockRank(inStock: boolean | null): number {
  if (inStock === true) return 0
  if (inStock == null) return 1
  return 2
}

function meetsRank(state: ChecklistState): number {
  switch (state) {
    case 'meets':
      return 0
    case 'unverified':
      return 1
    case 'misses':
      return 2
    default: {
      const neverState: never = state
      return neverState
    }
  }
}
