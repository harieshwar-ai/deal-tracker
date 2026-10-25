import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { useCatalog } from '../state/catalog'
import { watchCategories } from '../domain/watchlist'
import { normalizeCategory, normalizeEmail, normalizeUuid } from '../domain/alerts'
import { requestConfirmationEmail, subscribeErrorCopy, subscribeToAlerts } from '../data/alerts'
import type { AlertChoice } from '../data/alerts'
import { useToast } from './toast'
import { Button } from './ui/button'
import { Modal } from './ui/dialog'
import { Field, Input, controlClass } from './ui/input'

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
  const items = useMemo(
    () => catalog.items.map((item) => ({ id: item.id, name: item.name, category: item.category })),
    [catalog.items],
  )
  const categories = useMemo(
    () => watchCategories(catalog.items).filter((category) => category !== 'Uncategorized'),
    [catalog.items],
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
      push('ok', "You're already subscribed to these alerts.")
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
  const [category, setCategory] = useState(lockedCategory ?? '')
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
      <form className="grid gap-4" onSubmit={submit}>
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
              {lockedCategory ? `The ${lockedCategory} category` : 'A category'}
            </label>
          </fieldset>
        ) : (
          <p className="text-sm leading-6">
            {product ? `Alerts for ${product.name}.` : `Alerts for ${lockedCategory}.`}
          </p>
        )}
        {mode === 'item' && openEntry ? (
          <label className="block text-sm font-medium">
            Product
            <select
              className={`${controlClass} mt-1.5`}
              aria-label="Product"
              value={itemId}
              disabled={pending}
              onChange={(event) => setItemId(event.target.value)}
            >
              <option value="">Choose a product</option>
              {items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
        ) : null}
        {mode === 'category' && openEntry ? (
          <div>
            <label className="block text-sm font-medium">
              Category
              <Input
                className="mt-1.5"
                list="alert-categories"
                aria-label="Category"
                value={category}
                disabled={pending}
                onChange={(event) => setCategory(event.target.value)}
              />
            </label>
            <p className="mt-1 text-sm text-muted">Use the name Harbour shows, or a category you want watched.</p>
            <datalist id="alert-categories">
              {knownCategories.map((entry) => <option key={entry} value={entry} />)}
            </datalist>
          </div>
        ) : null}
        <label className="flex items-start gap-3 text-sm leading-6">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 accent-pine"
            checked={consent}
            disabled={pending}
            onChange={(event) => setConsent(event.target.checked)}
          />
          <span>I agree to receive email about public prices for this choice. Every message has an unsubscribe link.</span>
        </label>
        {error ? <p className="text-sm text-clay" role="alert">{error}</p> : null}
        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>{pending ? 'Sending…' : 'Email me a confirmation'}</Button>
        </div>
      </form>
    </Modal>
  )
}
