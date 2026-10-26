import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { FormEvent, KeyboardEvent, ReactNode } from 'react'
import { useCatalog } from '../state/catalog'
import { watchCategories } from '../domain/watchlist'
import { alertCategoryGroups, categoryLabel } from '../domain/labels'
import { normalizeCategory, normalizeEmail, normalizeUuid } from '../domain/alerts'
import { requestConfirmationEmail, subscribeErrorCopy, subscribeToAlerts } from '../data/alerts'
import type { AlertChoice } from '../data/alerts'
import { useToast } from './toast'
import { Button } from './ui/button'
import { Modal } from './ui/dialog'
import { Field, Input, controlClass } from './ui/input'
import { Select } from './ui/select'

export interface AlertPreset {
  itemId?: string | null
  itemName?: string | null
  category?: string | null
}

interface AlertItem {
  id: string
  name: string
  category: string | null
}

const AlertContext = createContext<((preset?: AlertPreset) => void) | null>(null)

export function useAlertSignup(): (preset?: AlertPreset) => void {
  const open = useContext(AlertContext)
  if (!open) throw new Error('useAlertSignup must be used inside AlertSignupProvider.')
  return open
}

export function AlertSignupProvider({ children }: { children: ReactNode }) {
  const catalog = useCatalog()
  const push = useToast()
  const [open, setOpen] = useState(false)
  const [preset, setPreset] = useState<AlertPreset>({})
  const [pending, setPending] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)
  const activeItems = useMemo(() => catalog.items.filter((item) => item.active), [catalog.items])
  const items = useMemo(
    () => activeItems.map((item) => ({ id: item.id, name: item.name, category: item.category })),
    [activeItems],
  )
  const categories = useMemo(
    () => watchCategories(activeItems).filter((category) => category !== 'Uncategorized'),
    [activeItems],
  )
  const openAlerts = useCallback((next?: AlertPreset) => {
    setPreset(next ?? {})
    setFormError(null)
    setPending(false)
    setNonce((value) => value + 1)
    setOpen(true)
  }, [])

  async function submit(choice: AlertChoice) {
    setPending(true)
    setFormError(null)
    const result = await subscribeToAlerts(choice)
    setPending(false)
    if (!result.ok) {
      setFormError(subscribeErrorCopy(result.error))
      return
    }
    if (result.result === 'already_confirmed') {
      const label = choice.itemId
        ? items.find((item) => item.id === choice.itemId)?.name
        : choice.category ? categoryLabel(choice.category) : null
      push('ok', label ? `You're already subscribed to ${label} alerts.` : "You're already subscribed to these alerts.")
      setOpen(false)
      return
    }
    void requestConfirmationEmail(result.subscriptionId, choice.email)
    push('ok', 'Check your inbox to confirm')
    setOpen(false)
  }

  return (
    <AlertContext.Provider value={openAlerts}>
      {children}
      <AlertSignupDialog
        key={nonce}
        open={open}
        pending={pending}
        formError={formError}
        items={items}
        categories={categories}
        preset={preset}
        onClose={() => setOpen(false)}
        onSubmit={(choice) => void submit(choice)}
      />
    </AlertContext.Provider>
  )
}

export function AlertSignupDialog({
  open,
  pending,
  formError,
  items,
  categories,
  preset,
  onClose,
  onSubmit,
}: {
  open: boolean
  pending: boolean
  formError: string | null
  items: AlertItem[]
  categories: string[]
  preset: AlertPreset
  onClose: () => void
  onSubmit: (choice: AlertChoice) => void
}) {
  const product = preset.itemId ? { id: preset.itemId, name: preset.itemName || 'This product' } : null
  const lockedCategory = preset.category ?? null
  const openEntry = !product && !lockedCategory
  const [mode, setMode] = useState<'item' | 'category'>(product || (openEntry && items.length > 0) ? 'item' : 'category')
  const [email, setEmail] = useState('')
  const [consent, setConsent] = useState(false)
  const [itemId, setItemId] = useState(product?.id ?? '')
  const [category, setCategory] = useState(lockedCategory ?? categories[0] ?? '')
  const [localError, setLocalError] = useState<string | null>(null)
  const showChoice = openEntry || Boolean(product && lockedCategory)
  const knownCategories = lockedCategory
    ? [lockedCategory, ...categories.filter((entry) => entry !== lockedCategory)]
    : categories

  function submit(event: FormEvent) {
    event.preventDefault()
    const normalized = normalizeEmail(email)
    if (!normalized) {
      setLocalError('Enter a valid email address.')
      return
    }
    if (!consent) {
      setLocalError('Consent is required.')
      return
    }
    if (mode === 'item') {
      const id = product?.id ?? normalizeUuid(itemId)
      if (!id) {
        setLocalError('Choose a product or a category.')
        return
      }
      setLocalError(null)
      onSubmit({ email: normalized, itemId: id, category: null })
      return
    }
    const nextCategory = normalizeCategory(!openEntry && lockedCategory ? lockedCategory : category)
    if (!nextCategory) {
      setLocalError('Choose a product or a category.')
      return
    }
    setLocalError(null)
    onSubmit({ email: normalized, itemId: null, category: nextCategory })
  }

  const error = localError ?? formError

  return (
    <Modal
      open={open}
      title="Get deal alerts"
      description="Harbour emails you after you confirm. Messages only include the public product name, price, store, and link."
      onClose={onClose}
    >
      <form className="grid gap-4" noValidate onSubmit={submit}>
        <Field label="Email">
          <Input
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            disabled={pending}
            aria-invalid={error === 'Enter a valid email address.'}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>
        {showChoice ? (
          <fieldset className="grid gap-2">
            <legend className="text-sm font-medium">What should we watch?</legend>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="alert-target"
                value="item"
                checked={mode === 'item'}
                disabled={pending || (openEntry && items.length === 0)}
                onChange={() => setMode('item')}
              />
              {product ? product.name : 'A product'}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="alert-target"
                value="category"
                checked={mode === 'category'}
                disabled={pending}
                onChange={() => setMode('category')}
              />
              {lockedCategory ? `The ${categoryLabel(lockedCategory)} category` : 'A category'}
            </label>
          </fieldset>
        ) : (
          <p className="text-sm leading-6 text-ink">
            {product ? `Alerts for ${product.name}.` : `Alerts for ${categoryLabel(lockedCategory)}.`}
          </p>
        )}
        {mode === 'item' && openEntry ? (
          <ItemCombobox items={items} value={itemId} disabled={pending} onChange={setItemId} />
        ) : null}
        {mode === 'category' && openEntry ? (
          <div>
            <p className="text-sm font-medium text-ink">Category</p>
            {knownCategories.length === 0 ? (
              <p className="mt-1.5 text-sm text-muted">No categories on the watchlist yet.</p>
            ) : (
              <Select
                label="Category"
                className="mt-1.5 w-full min-w-0"
                value={category}
                onValueChange={setCategory}
                groups={alertCategoryGroups(knownCategories)}
                side="top"
                sideOffset={8}
              />
            )}
          </div>
        ) : null}
        <label className="flex items-start gap-3 text-sm leading-6 text-ink">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 accent-pine focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pine"
            checked={consent}
            required
            aria-required="true"
            onInvalid={(event) => event.preventDefault()}
            disabled={pending}
            onChange={(event) => setConsent(event.target.checked)}
          />
          <span>I agree to receive email about public prices for this choice. Every message has an unsubscribe link.</span>
        </label>
        {error ? <p className="text-sm text-clay" role="alert">{error}</p> : null}
        <div className="flex justify-end">
          <Button type="submit" disabled={pending || !consent}>{pending ? 'Sending…' : 'Email me a confirmation'}</Button>
        </div>
      </form>
    </Modal>
  )
}

function ItemCombobox({
  items,
  value,
  disabled,
  onChange,
}: {
  items: AlertItem[]
  value: string
  disabled: boolean
  onChange: (id: string) => void
}) {
  const selected = items.find((item) => item.id === value) ?? null
  const [query, setQuery] = useState(selected?.name ?? '')
  const [open, setOpen] = useState(false)
  const needle = query.trim().toLowerCase()
  const matches = items.filter((item) => item.name.toLowerCase().includes(needle))

  function choose(id: string) {
    const item = items.find((entry) => entry.id === id)
    onChange(id)
    setQuery(item?.name ?? '')
    setOpen(false)
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setOpen(false)
      return
    }
    if (event.key === 'Enter' && open && matches[0]) {
      event.preventDefault()
      choose(matches[0].id)
    }
  }

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-ink" htmlFor="alert-product">
        Product
      </label>
      <input
        id="alert-product"
        className={`${controlClass} mt-1.5`}
        role="combobox"
        aria-label="Product"
        aria-expanded={open}
        aria-controls="alert-products"
        aria-autocomplete="list"
        value={query}
        disabled={disabled}
        placeholder="Search products"
        onChange={(event) => {
          setQuery(event.target.value)
          onChange('')
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
      />
      {open ? (
        <ul id="alert-products" role="listbox" aria-label="Products" className="absolute z-20 mt-1 max-h-52 w-full overflow-auto rounded-lg border border-line bg-paper-2 p-1 text-ink shadow-lg">
          {matches.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted">No matching products.</li>
          ) : matches.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                role="option"
                aria-selected={item.id === value}
                className="w-full rounded-md px-3 py-2 text-left text-sm text-ink hover:bg-pine-soft focus-visible:bg-pine-soft focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-pine"
                onMouseDown={(event) => {
                  event.preventDefault()
                  choose(item.id)
                }}
              >
                {item.name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
