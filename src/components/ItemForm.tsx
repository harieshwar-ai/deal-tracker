import { useState } from 'react'
import type { FormEvent } from 'react'
import { fieldError, parseItemDraft } from '../domain/drafts'
import type { FieldError, ItemDraft, ItemWrite } from '../domain/types'
import { Button, controlClass, Field, Toggle } from './ui'

export function ItemForm({
  initial,
  categories,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: ItemDraft
  categories: string[]
  submitLabel: string
  onSubmit: (write: ItemWrite) => Promise<void>
  onCancel: () => void
}) {
  const [draft, setDraft] = useState(initial)
  const [errors, setErrors] = useState<FieldError[]>([])
  const [pending, setPending] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const target = Number(draft.targetPrice)
  const ceiling = Number(draft.maxPrice)
  const ceilingHint =
    draft.targetPrice.trim() && draft.maxPrice.trim() && Number.isFinite(target) && Number.isFinite(ceiling) && ceiling < target
      ? 'The ceiling is below the target.'
      : 'The most you would still consider paying.'

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const parsed = parseItemDraft(draft)
    if (!parsed.ok) {
      setErrors(parsed.errors)
      setFormError(null)
      return
    }
    setPending(true)
    setFormError(null)
    try {
      await onSubmit(parsed.value)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not save the item.')
      setPending(false)
    }
  }

  return (
    <form className="grid gap-4" onSubmit={(event) => void handleSubmit(event)}>
      <Field label="Name" error={fieldError(errors, 'name')}>
        <input className={controlClass} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} required />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Category" error={fieldError(errors, 'category')}>
          <input className={controlClass} list="item-categories" value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} placeholder="Electronics" />
          <datalist id="item-categories">
            {categories.map((category) => <option key={category} value={category} />)}
          </datalist>
        </Field>
        <Field label="Condition" error={fieldError(errors, 'condition')}>
          <input className={controlClass} list="item-conditions" value={draft.condition} onChange={(event) => setDraft({ ...draft, condition: event.target.value })} />
          <datalist id="item-conditions">
            <option value="new" />
            <option value="open-box" />
            <option value="refurbished" />
            <option value="used" />
          </datalist>
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Priority">
          <select className={controlClass} value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: event.target.value as ItemDraft['priority'] })}>
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
          </select>
        </Field>
        <Toggle checked={draft.active} label={draft.active ? 'Active on the watchlist' : 'Paused'} onChange={(active) => setDraft({ ...draft, active })} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Target price" hint="Compared with the latest in-stock CAD price." error={fieldError(errors, 'targetPrice')}>
          <input className={controlClass} inputMode="decimal" value={draft.targetPrice} onChange={(event) => setDraft({ ...draft, targetPrice: event.target.value })} placeholder="0.00" />
        </Field>
        <Field label="Max price" hint={ceilingHint} error={fieldError(errors, 'maxPrice')}>
          <input className={controlClass} inputMode="decimal" value={draft.maxPrice} onChange={(event) => setDraft({ ...draft, maxPrice: event.target.value })} placeholder="0.00" />
        </Field>
      </div>
      <Field label="Keywords" hint="Comma-separated. Used by search and the price checker." error={fieldError(errors, 'keywords')}>
        <input className={controlClass} value={draft.keywords} onChange={(event) => setDraft({ ...draft, keywords: event.target.value })} placeholder="oled, 65 inch" />
      </Field>
      <Field label="Description" error={fieldError(errors, 'description')}>
        <textarea className={controlClass} rows={3} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
      </Field>
      <Field label="Notes" error={fieldError(errors, 'notes')}>
        <textarea className={controlClass} rows={3} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} />
      </Field>
      {formError ? <p className="text-sm text-clay">{formError}</p> : null}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={pending}>Cancel</Button>
        <Button type="submit" disabled={pending}>{pending ? 'Saving…' : submitLabel}</Button>
      </div>
    </form>
  )
}
