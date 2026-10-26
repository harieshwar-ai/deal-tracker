import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { FadeIn } from '../components/motion'
import { confirmAlert } from '../data/alerts'
import { categoryLabel } from '../domain/labels'
import { useDocumentTitle } from '../lib/title'
import { useCatalog } from '../state/catalog'

type State = 'loading' | 'confirmed' | 'already' | 'invalid' | 'missing' | 'error'

const copy: Record<State, { title: string; body: string }> = {
  loading: { title: 'Confirming…', body: 'Harbour is checking this link.' },
  confirmed: { title: 'You’re confirmed', body: 'Harbour will email you when a public price is recorded.' },
  already: { title: 'Already confirmed', body: 'This alert was already confirmed.' },
  invalid: { title: 'Link not valid', body: 'This confirmation link is not valid.' },
  missing: { title: 'Confirmation link incomplete', body: 'Open the full link from the email.' },
  error: { title: 'Could not confirm', body: 'Harbour could not confirm that link. Try it again.' },
}

export function ConfirmPage() {
  const [params] = useSearchParams()
  const catalog = useCatalog()
  const token = params.get('token')
  const [state, setState] = useState<State>(token ? 'loading' : 'missing')
  const [target, setTarget] = useState<{ category: string | null; itemId: string | null } | null>(null)
  useDocumentTitle('Confirm alerts')

  useEffect(() => {
    if (!token) return
    let active = true
    void confirmAlert(token).then((result) => {
      if (!active) return
      if (result.ok) setTarget({ category: result.category, itemId: result.itemId })
      if (result.ok && result.result === 'confirmed') setState('confirmed')
      else if (result.ok) setState('already')
      else if (result.error === 'invalid_token') setState('invalid')
      else setState('error')
    })
    return () => {
      active = false
    }
  }, [token])

  const message = copy[state]
  const targetLabel = target?.itemId
    ? catalog.items.find((item) => item.id === target.itemId)?.name ?? null
    : target?.category ? categoryLabel(target.category) : null
  const body = targetLabel && (state === 'confirmed' || state === 'already')
    ? `${message.body.replace(/\.$/, '')} for ${targetLabel}.`
    : message.body
  return (
    <FadeIn>
      <div className="mx-auto max-w-lg">
        <h1 className="font-display text-4xl">{message.title}</h1>
        <p className="mt-3 text-sm leading-6 text-muted" role="status">{body}</p>
        <Link className="mt-6 inline-block text-sm text-pine underline" to="/">Back to the watchlist</Link>
      </div>
    </FadeIn>
  )
}
