import { explainAuthFailure } from './callback'
import type { AuthFailure } from './callback'

export interface ExchangeOutcome {
  errorMessage: string | null
}

type ExchangeFn = (code: string) => Promise<{ error: AuthFailure | null }>

const inflight = new Map<string, Promise<ExchangeOutcome>>()

export function resetCodeExchangeForTests(): void {
  inflight.clear()
}

export function exchangeCodeOnce(code: string, exchange: ExchangeFn): Promise<ExchangeOutcome> {
  const existing = inflight.get(code)
  if (existing) return existing
  const promise = exchange(code)
    .then(({ error }) => ({ errorMessage: error ? explainAuthFailure(error) : null }))
    .catch((error: unknown) => ({
      errorMessage: error instanceof Error
        ? explainAuthFailure({ message: error.message, name: error.name })
        : 'Could not finish signing in.',
    }))
  inflight.set(code, promise)
  return promise
}
