import { ArrowDown, ArrowUp } from 'lucide-react'
import { useState } from 'react'
import { saleCountdown } from '../domain/compare'
import { formatCad, formatDay, formatRelative, safeHttpUrl } from '../domain/format'
import {
  checklistLabel,
  sortComparedProducts,
  sortStoreRows,
  storeNamesFor,
} from '../domain/productCompare'
import type { ComparedProduct, ProductSortKey, ProductStoreCell, SortDirection, StoreSortKey, StoreTableRow } from '../domain/productCompare'
import { cn } from '../lib/cn'

export function ProductCompare({ products }: { products: ComparedProduct[] }) {
  const [key, setKey] = useState<ProductSortKey>('total')
  const [direction, setDirection] = useState<SortDirection>('asc')
  const ordered = sortComparedProducts(products, key, direction)
  const stores = storeNamesFor(ordered)
  if (products.length === 0) {
    return <p className="mt-3 text-sm text-muted">No candidate products are saved for this item yet.</p>
  }
  return (
    <div className="mt-3">
      <div className="flex flex-wrap gap-2">
        <span className="self-center text-sm text-muted">Sort by</span>
        <SortChoice label="Tax-in total" sortKey="total" current={key} direction={direction} onKey={setKey} onDirection={setDirection} />
        <SortChoice label="Lowest seen" sortKey="lowest" current={key} direction={direction} onKey={setKey} onDirection={setDirection} />
        <SortChoice label="Checklist" sortKey="meets" current={key} direction={direction} onKey={setKey} onDirection={setDirection} />
        <SortChoice label="Stock" sortKey="stock" current={key} direction={direction} onKey={setKey} onDirection={setDirection} />
      </div>
      <p className="mt-3 text-sm text-muted md:hidden">Swipe sideways to compare every column.</p>
      <div className="mt-3 max-h-[70vh] overflow-auto rounded-xl border border-line">
        <table className="w-full min-w-[36rem] border-separate border-spacing-0 text-left text-sm">
          <caption className="sr-only">Candidate products compared by checklist, stock, lowest price, and tax-in store price</caption>
          <thead>
            <tr>
              <th scope="col" className="sticky top-0 left-0 z-30 bg-paper px-4 py-3 font-medium text-muted">Detail</th>
              {ordered.map((product) => (
                <th key={product.key} scope="col" className="sticky top-0 z-20 min-w-44 bg-paper px-4 py-3 font-medium">
                  {product.name}
                  {product.best ? <span className="mt-1 block text-xs font-medium text-buy">Lowest tax-in price</span> : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-paper-2">
            <AttributeRow label="Checklist" values={ordered.map((product) => checklistLabel(product.meets))} emphasize={ordered.map((product) => product.meets === 'meets')} />
            <AttributeRow label="Stock" values={ordered.map((product) => stockLabel(product.stock))} />
            <AttributeRow
              label="Lowest qualifying in-stock price"
              values={ordered.map((product) => product.lowest && !product.lowest.outOfStock ? formatCad(product.lowest.price) : '—')}
            />
            {stores.map((store) => (
              <tr key={store} className="border-t border-line">
                <th scope="row" className="sticky left-0 z-10 border-t border-line bg-paper-2 px-4 py-3 font-medium">{store}</th>
                {ordered.map((product) => {
                  const cell = product.cells.find((entry) => entry.storeName === store)
                  return (
                    <td key={product.key} className="border-t border-line px-4 py-3 align-top">
                      <CellPrice cell={cell} />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function StoreTable({ rows, now = new Date() }: { rows: StoreTableRow[]; now?: Date }) {
  const [key, setKey] = useState<StoreSortKey>('total')
  const [direction, setDirection] = useState<SortDirection>('asc')
  const ordered = sortStoreRows(rows, key, direction)
  if (rows.length === 0) return <p className="text-sm text-muted">No current store prices yet.</p>
  const columns: { key: StoreSortKey | 'product'; label: string; sortable: boolean }[] = [
    { key: 'store', label: 'Store', sortable: true },
    { key: 'product', label: 'Product', sortable: false },
    { key: 'price', label: 'Price', sortable: true },
    { key: 'total', label: 'Tax-in total', sortable: true },
    { key: 'stock', label: 'Stock', sortable: true },
    { key: 'lowest', label: 'Lowest seen', sortable: true },
    { key: 'meets', label: 'Checklist', sortable: true },
  ]
  return (
    <div>
      <p className="mb-3 text-sm text-muted md:hidden">Swipe sideways to compare every column.</p>
      <div className="max-h-[70vh] overflow-auto rounded-xl border border-line">
      <table className="w-full min-w-[52rem] border-separate border-spacing-0 text-left text-sm">
        <caption className="sr-only">Stores compared by price, Ontario HST, shipping, stock, and lowest in-stock price</caption>
        <thead>
          <tr>
            {columns.map((column, index) => (
              <th
                key={column.key}
                scope="col"
                aria-sort={key === column.key ? ariaSort(direction) : 'none'}
                className={cn('sticky top-0 z-20 bg-paper px-3 py-3 font-medium', index === 0 && 'left-0 z-30')}
              >
                {column.sortable && column.key !== 'product' ? (
                  <SortButton
                    label={column.label}
                    active={key === column.key}
                    direction={direction}
                    onClick={() => {
                      if (column.key === 'product') return
                      toggle(key, direction, column.key, setKey, setDirection)
                    }}
                  />
                ) : column.label}
              </th>
            ))}
            <th scope="col" className="sticky top-0 z-20 bg-paper px-3 py-3 font-medium">Listing</th>
          </tr>
        </thead>
        <tbody className="bg-paper-2">
          {ordered.map((row) => {
            const href = safeHttpUrl(row.productUrl)
            const countdown = saleCountdown(row.saleEndsAt, now)
            return (
              <tr key={`${row.productKey}-${row.snapshotId}`}>
                <th scope="row" className="sticky left-0 z-10 border-t border-line bg-paper-2 px-3 py-3 font-medium">
                  {row.storeName}
                  {row.bestPrice ? <span className="mt-1 block text-xs font-medium text-buy">Lowest price</span> : null}
                  {row.variantHeading ? <span className="mt-1 block text-xs font-normal text-muted">{row.variantHeading}</span> : null}
                </th>
                <td className="border-t border-line px-3 py-3">
                  {row.productLabel || row.productName || '—'}
                </td>
                <td className="border-t border-line px-3 py-3 tabular-nums">{formatCad(row.price)}</td>
                <td className="border-t border-line px-3 py-3">
                  <span className="tabular-nums">{row.shippingKnown ? formatCad(row.total) : `${formatCad(row.total)} + shipping`}</span>
                  <span className="mt-1 block text-xs text-muted">
                    HST {formatCad(row.tax)} · {row.shippingKnown ? `shipping ${formatCad(row.shipping)}` : 'shipping unknown'}
                  </span>
                  {countdown ? <span className="mt-1 block text-xs">{countdown}</span> : null}
                </td>
                <td className={cn('border-t border-line px-3 py-3', row.inStock === false && 'text-rise')}>{stockLabel(row.inStock)}</td>
                <td className="border-t border-line px-3 py-3 tabular-nums">
                  {row.lowest == null ? '—' : formatCad(row.lowest)}
                  {row.lowestOutOfStock ? <span className="mt-1 block text-xs text-muted">Out of stock</span> : null}
                </td>
                <td className="border-t border-line px-3 py-3">{checklistLabel(row.meets)}</td>
                <td className="border-t border-line px-3 py-3">
                  {href ? <a className="text-pine underline" href={href} target="_blank" rel="noopener noreferrer">Open</a> : '—'}
                  {row.capturedAt ? <span className="mt-1 block text-xs text-muted">{formatRelative(row.capturedAt)}</span> : null}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      </div>
    </div>
  )
}

function CellPrice({ cell }: { cell: ProductStoreCell | undefined }) {
  if (!cell) return <span className="text-muted">No price</span>
  const href = safeHttpUrl(cell.url)
  return (
    <div>
      <p className="font-mono tabular-nums">{cell.shippingKnown ? formatCad(cell.total) : `${formatCad(cell.total)} + shipping`}</p>
      <p className="text-xs text-muted">
        {formatCad(cell.price)} + HST {formatCad(cell.tax)}
        {cell.shippingKnown ? ` + shipping ${formatCad(cell.shipping)}` : ' · shipping unknown'}
      </p>
      <p className="text-xs">{stockLabel(cell.inStock)} · {checklistLabel(cell.meets)}</p>
      {cell.variantHeading ? <p className="text-xs text-muted">{cell.variantHeading}</p> : null}
      {cell.capturedAt ? <p className="text-xs text-muted">Seen {formatDay(cell.capturedAt)}</p> : null}
      {href ? <a className="text-xs text-pine underline" href={href} target="_blank" rel="noopener noreferrer">Open listing</a> : null}
    </div>
  )
}

function AttributeRow({ label, values, emphasize }: { label: string; values: string[]; emphasize?: boolean[] }) {
  return (
    <tr>
      <th scope="row" className="sticky left-0 z-10 border-t border-line bg-paper-2 px-4 py-3 font-medium">{label}</th>
      {values.map((value, index) => (
        <td key={`${label}-${index}`} className={cn('border-t border-line px-4 py-3', emphasize?.[index] && 'text-buy')}>{value}</td>
      ))}
    </tr>
  )
}

function SortChoice({
  label,
  sortKey,
  current,
  direction,
  onKey,
  onDirection,
}: {
  label: string
  sortKey: ProductSortKey
  current: ProductSortKey
  direction: SortDirection
  onKey: (key: ProductSortKey) => void
  onDirection: (direction: SortDirection) => void
}) {
  const active = current === sortKey
  return (
    <button
      type="button"
      className={cn('rounded-full border px-3 py-1 text-sm', active ? 'border-pine bg-pine-soft text-ink' : 'border-line')}
      aria-pressed={active}
      onClick={() => toggle(current, direction, sortKey, onKey, onDirection)}
    >
      {label}{active ? (direction === 'asc' ? ' ascending' : ' descending') : ''}
    </button>
  )
}

function SortButton({
  label,
  active,
  direction,
  onClick,
}: {
  label: string
  active: boolean
  direction: SortDirection
  onClick: () => void
}) {
  const Icon = direction === 'asc' ? ArrowUp : ArrowDown
  return (
    <button type="button" className="inline-flex items-center gap-1 text-left font-medium" onClick={onClick}>
      {label}
      {active ? <Icon className="h-3.5 w-3.5" aria-hidden="true" /> : null}
      <span className="sr-only">{active ? (direction === 'asc' ? ', sorted ascending' : ', sorted descending') : ', sort'}</span>
    </button>
  )
}

function toggle<K extends string>(
  current: K,
  direction: SortDirection,
  next: K,
  onKey: (key: K) => void,
  onDirection: (direction: SortDirection) => void,
) {
  if (current === next) onDirection(direction === 'asc' ? 'desc' : 'asc')
  else {
    onKey(next)
    onDirection('asc')
  }
}

function ariaSort(direction: SortDirection): 'ascending' | 'descending' {
  return direction === 'asc' ? 'ascending' : 'descending'
}

function stockLabel(inStock: boolean | null): string {
  if (inStock == null) return 'Stock unknown'
  return inStock ? 'In stock' : 'Out of stock'
}
