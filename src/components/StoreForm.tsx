import { useState } from 'react'
import type { FormEvent } from 'react'
import { fieldError, parseStoreDraft } from '../domain/drafts'
import type { FieldError, StoreDraft, StoreWrite } from '../domain/types'
import { Button, controlClass, Field, Toggle } from './ui'

export function StoreForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: StoreDraft
  submitLabel: string
  onSubmit: (write: StoreWrite) => Promise<void>
  onCancel: () => void
}) {
  const [draft, setDraft] = useState(initial)
  const [errors, setErrors] = useState<FieldError[]>([])
  const [pending, setPending] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const parsed = parseStoreDraft(draft)
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
      setFormError(error instanceof Error ? error.message : 'Could not save the store.')
      setPending(false)
    }
  }

  return (
    <form className="grid gap-4" onSubmit={(event) => void handleSubmit(event)}>
      <Field label="Name" error={fieldError(errors, 'name')}>
        <input className={controlClass} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} required />
      </Field>
      <Field label="Website" hint="Optional. http or https." error={fieldError(errors, 'baseUrl')}>
        <input className={controlClass} inputMode="url" value={draft.baseUrl} onChange={(event) => setDraft({ ...draft, baseUrl: event.target.value })} placeholder="https://www.bestbuy.ca" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Country" error={fieldError(errors, 'country')}>
          <input className={controlClass} value={draft.country} onChange={(event) => setDraft({ ...draft, country: event.target.value })} />
        </Field>
        <Field label="Membership" error={fieldError(errors, 'membership')}>
          <input className={controlClass} value={draft.membership} onChange={(event) => setDraft({ ...draft, membership: event.target.value })} placeholder="Prime, Executive…" />
        </Field>
      </div>
      <Toggle checked={draft.enabled} label={draft.enabled ? 'Enabled for price checks' : 'Disabled'} onChange={(enabled) => setDraft({ ...draft, enabled })} />
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
