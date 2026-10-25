import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { FadeIn } from '../components/motion'
import { unsubscribeAlert } from '../data/alerts'
import { useDocumentTitle } from '../lib/title'

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
  const token = params.get('token')
  const [state, setState] = useState<State>(token ? 'loading' : 'missing')
  useDocumentTitle('Unsubscribe')

  useEffect(() => {
    if (!token) return
    let active = true
    void unsubscribeAlert(token).then((result) => {
      if (!active) return
      if (result.ok) setState('done')
      else if (result.error === 'invalid_token') setState('invalid')
      else setState('error')
    })
    return () => {
      active = false
    }
  }, [token])

  const message = copy[state]
  return (
    <FadeIn>
      <div className="mx-auto max-w-lg">
        <h1 className="font-display text-4xl">{message.title}</h1>
        <p className="mt-3 text-sm leading-6 text-muted" role="status">{message.body}</p>
        <Link className="mt-6 inline-block text-sm text-pine underline" to="/">Back to the watchlist</Link>
      </div>
    </FadeIn>
  )
}
