import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { FadeIn } from '../components/motion'
import { unsubscribeAlert } from '../data/alerts'
import { unsubscribeCountryWaitlist } from '../data/waitlist'
import { categoryLabel } from '../domain/labels'
import { useDocumentTitle } from '../lib/title'
import { useCatalog } from '../state/catalog'

type State = 'loading' | 'done' | 'invalid' | 'missing' | 'error'

const copy: Record<State, { title: string; body: string }> = {
  loading: { title: 'Unsubscribing…', body: 'Harbour is checking this link.' },
  done: { title: 'You’re unsubscribed', body: 'Harbour will stop emailing this alert.' },
  invalid: { title: 'Link not valid', body: 'This unsubscribe link is not valid.' },
  missing: { title: 'Unsubscribe link incomplete', body: 'Open the full link from the email.' },
  error: { title: 'Could not unsubscribe', body: 'Harbour could not unsubscribe that link. Try it again.' },
}

export function UnsubscribePage() {
  const [params] = useSearchParams()
  const catalog = useCatalog()
  const token = params.get('token')
  const waitlist = params.get('waitlist') === '1'
  const [state, setState] = useState<State>(token ? 'loading' : 'missing')
  const [target, setTarget] = useState<{ category: string | null; itemId: string | null } | null>(null)
  useDocumentTitle('Unsubscribe')

  useEffect(() => {
    if (!token) return
    let active = true
    const run = waitlist ? unsubscribeCountryWaitlist(token) : unsubscribeAlert(token)
    void run.then((result) => {
      if (!active) return
      if (result.ok) {
        if (!waitlist && 'category' in result) setTarget({ category: result.category, itemId: result.itemId })
        setState('done')
      } else if (result.error === 'invalid_token') setState('invalid')
      else setState('error')
    })
    return () => {
      active = false
    }
  }, [token, waitlist])

  const message = copy[state]
  const targetLabel = target?.itemId
    ? catalog.items.find((item) => item.id === target.itemId)?.name ?? null
    : target?.category ? categoryLabel(target.category) : null
  const body = targetLabel && state === 'done'
    ? `Harbour will stop emailing ${targetLabel} alerts.`
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
