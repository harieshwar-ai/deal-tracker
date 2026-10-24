import { ChevronDown } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useId, useState } from 'react'
import { discountPercent, formatCad, safeHttpUrl } from '../domain/format'
import type { StoreVariant } from '../domain/compare'
import type { Quote } from '../domain/quotes'
import { cn } from '../lib/cn'
import { StoreMark } from './product'

const ease = [0.2, 0, 0, 1] as const

export function OfferChip({ quote, best }: { quote: Quote; best: boolean }) {
  const multiple = quote.variants.length > 1
  const [open, setOpen] = useState(false)
  const [selectedId, setSelectedId] = useState(quote.snapshotId)
  const reduce = useReducedMotion()
  const panelId = useId()
  const selected = quote.variants.find((variant) => variant.snapshotId === selectedId) ?? quote.variants[0]
  const href = safeHttpUrl(selected?.productUrl ?? quote.productUrl)
  const price = selected?.price ?? quote.price
  const stock = selected?.inStock ?? quote.inStock
  const summary = variantSummary(quote)
  const discount = discountPercent(price, selected?.regularPrice ?? quote.regularPrice)

  if (!multiple) {
    const singleDiscount = discountPercent(quote.price, quote.regularPrice)
    return (
      <li>
        {href ? (
          <a href={href} target="_blank" rel="noopener noreferrer" className={chipClass(best)}>
            <ChipBody name={quote.storeName} price={quote.price} discount={singleDiscount} stock={quote.inStock} />
          </a>
        ) : (
          <span className={chipClass(best)}>
            <ChipBody name={quote.storeName} price={quote.price} discount={singleDiscount} stock={quote.inStock} />
          </span>
        )}
      </li>
    )
  }

  return (
    <li className="min-w-0">
      <div className={cn(chipClass(best), 'items-stretch')}>
        <button
          type="button"
          className="inline-flex flex-wrap items-center gap-1 text-left"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((value) => !value)}
        >
          <ChipBody name={quote.storeName} price={price} discount={discount} stock={stock} />
          {summary ? <span className="text-muted">{summary}</span> : null}
          <ChevronDown className={cn('h-3.5 w-3.5 text-muted motion-reduce:transition-none transition-transform duration-200', open && 'rotate-180')} />
        </button>
        <AnimatePresence initial={false}>
          {open ? (
            <motion.ul
              id={panelId}
              key="variants"
              initial={reduce ? false : { height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={reduce ? { height: 'auto', opacity: 1 } : { height: 0, opacity: 0 }}
              transition={reduce ? { duration: 0 } : { duration: 0.22, ease }}
              className="mt-1 grid gap-1 overflow-hidden border-t border-line pt-1"
            >
              {quote.variants.map((variant) => {
                const variantHref = safeHttpUrl(variant.productUrl)
                const selectedVariant = variant.snapshotId === selected?.snapshotId
                return (
                  <li key={variant.snapshotId}>
                    <button
                      type="button"
                      className={cn(
                        'flex w-full flex-wrap items-baseline gap-x-2 rounded-lg px-1 py-0.5 text-left motion-reduce:transition-none transition-colors duration-200',
                        selectedVariant ? 'bg-paper text-ink' : 'hover:bg-paper',
                      )}
                      aria-pressed={selectedVariant}
                      onClick={() => setSelectedId(variant.snapshotId)}
                    >
                      <span>{variant.label ?? 'Option'}</span>
                      <span className="tabular-nums">{formatCad(variant.price)}</span>
                      <span className={variant.inStock === false ? 'text-rise' : 'text-muted'}>
                        {variant.inStock == null ? 'Stock unknown' : variant.inStock ? 'In stock' : 'Out of stock'}
                      </span>
                      {variant.best ? <span className="text-drop">Lowest</span> : null}
                    </button>
                    {variantHref ? (
                      <a className="px-1 text-pine underline" href={variantHref} target="_blank" rel="noopener noreferrer">
                        Open {variant.label ?? 'listing'}
                      </a>
                    ) : null}
                  </li>
                )
              })}
            </motion.ul>
          ) : null}
        </AnimatePresence>
      </div>
    </li>
  )
}

export function VariantPicker({
  heading,
  variants,
  selectedId,
  onSelect,
}: {
  heading: string
  variants: StoreVariant[]
  selectedId: number
  onSelect: (snapshotId: number) => void
}) {
  const name = useId()
  return (
    <fieldset className="mt-3">
      <legend className="text-sm font-medium text-muted">{heading}</legend>
      <div className="mt-2 grid gap-2">
        {variants.map((variant) => {
          const selected = variant.snapshotId === selectedId
          const href = safeHttpUrl(variant.productUrl)
          return (
            <div
              key={variant.snapshotId}
              className={cn(
                'flex flex-wrap items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 motion-reduce:transition-none transition-colors duration-200',
                selected ? 'border-pine bg-pine-soft' : 'border-line bg-paper',
              )}
            >
              <label className="flex min-w-0 flex-1 cursor-pointer flex-wrap items-baseline gap-x-2 text-sm">
                <input
                  className="accent-pine"
                  type="radio"
                  name={name}
                  checked={selected}
                  onChange={() => onSelect(variant.snapshotId)}
                />
                <span>{variant.label ?? 'Option'}</span>
                <span className="tabular-nums">{formatCad(variant.price)}</span>
                <span className={variant.inStock === false ? 'text-rise' : 'text-muted'}>
                  {variant.inStock == null ? 'Stock unknown' : variant.inStock ? 'In stock' : 'Out of stock'}
                </span>
                {variant.best ? <span className="text-drop">Lowest</span> : null}
              </label>
              {href ? (
                <a className="text-sm text-pine underline" href={href} target="_blank" rel="noopener noreferrer">
                  Open
                </a>
              ) : null}
            </div>
          )
        })}
      </div>
    </fieldset>
  )
}

function variantSummary(quote: Quote): string | null {
  if (!quote.variantHeading || quote.variants.length < 2) return null
  const labels = quote.variants.map((variant) => variant.label).filter((label): label is string => Boolean(label))
  if (labels.length === 0) return `${quote.variants.length} options`
  return `${quote.variantHeading}: ${labels.join(', ')}`
}

function ChipBody({
  name,
  price,
  discount,
  stock,
}: {
  name: string
  price: number
  discount: number | null
  stock: boolean | null
}) {
  return (
    <>
      <StoreMark name={name} />
      <span>{name}</span> {formatCad(price)}
      {discount != null && discount > 0 ? <span className="text-drop"> {Math.round(discount)}%</span> : null}
      {stock === false ? <span className="text-rise"> out</span> : null}
    </>
  )
}

function chipClass(best: boolean): string {
  return best
    ? 'inline-flex flex-wrap items-center gap-1 rounded-full border border-pine bg-pine-soft px-2.5 py-1 text-sm tabular-nums'
    : 'inline-flex flex-wrap items-center gap-1 rounded-full border border-line px-2.5 py-1 text-sm tabular-nums'
}
