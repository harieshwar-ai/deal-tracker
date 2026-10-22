import { describe, expect, it } from 'vitest'
import {
  explainAuthFailure,
  captureAuthCallback,
  friendlyCallbackMessage,
  readAuthCallback,
  resetCapturedCallbackForTests,
  readWaitUntil,
  remainingCooldown,
  rememberWaitUntil,
  stripAuthSearch,
  waitUntilAfterSend,
} from './callback'
import { exchangeCodeOnce, resetCodeExchangeForTests } from './exchange'

describe('auth callback', () => {
  it('reads the magic-link code and strips it without dropping other params', () => {
    const search = '?code=abc-123&preview=1'
    expect(readAuthCallback(search).code).toBe('abc-123')
    expect(stripAuthSearch(search)).toBe('?preview=1')
    expect(stripAuthSearch('?code=abc-123')).toBe('')
  })

  it('turns otp_expired into a message the sign-in page can show', () => {
    resetCapturedCallbackForTests()
    const search = '?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired'
    const callback = readAuthCallback(search)
    expect(callback.errorCode).toBe('otp_expired')
    expect(callback.errorDescription).toBe('Email link is invalid or has expired')
    expect(friendlyCallbackMessage(callback)).toMatch(/expired/)
    expect(stripAuthSearch(search)).toBe('')
    const first = captureAuthCallback(search)
    const second = captureAuthCallback('')
    expect(second).toBe(first)
    expect(second.message).toMatch(/expired/)
  })

  it('explains a missing verifier, an invalid code, and a 429', () => {
    expect(explainAuthFailure({
      message: 'PKCE code verifier not found in storage.',
      name: 'AuthPKCECodeVerifierMissingError',
      code: 'pkce_code_verifier_not_found',
    })).toMatch(/6-digit code/)
    expect(explainAuthFailure({ message: 'Invalid login credentials', status: 400 })).toMatch(/password/)
    expect(explainAuthFailure({ message: 'Email link is invalid or has expired', code: 'otp_expired' })).toMatch(/expired/)
    expect(explainAuthFailure({ message: 'Email rate limit exceeded', status: 429 })).toMatch(/two emails an hour/)
    expect(explainAuthFailure({ message: 'Signups not allowed for this instance', status: 422 })).toMatch(/owner/)
  })

  it('cools down the send button, and longer after a rate limit', () => {
    const now = 1_000_000
    expect(waitUntilAfterSend(null, now) - now).toBe(60_000)
    expect(waitUntilAfterSend({ message: 'For security purposes, you can only request this after 42 seconds.', status: 429 }, now) - now).toBe(42_000)
    expect(waitUntilAfterSend({ message: 'Email rate limit exceeded', status: 429 }, now) - now).toBe(30 * 60 * 1000)
    const storage = new Map<string, string>()
    const memory = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value)
      },
    }
    rememberWaitUntil(memory, now + 5000)
    expect(readWaitUntil(memory)).toBe(now + 5000)
    expect(remainingCooldown(readWaitUntil(memory), now)).toBe(5000)
    expect(remainingCooldown(readWaitUntil(memory), now + 5000)).toBe(0)
  })

  it('exchanges one code once, even when React runs the effect twice', async () => {
    resetCodeExchangeForTests()
    let calls = 0
    const exchange = (code: string) => {
      calls += 1
      return Promise.resolve({ error: code === 'bad' ? { message: 'nope', code: 'otp_expired' } : null })
    }
    const [first, second] = await Promise.all([
      exchangeCodeOnce('good', exchange),
      exchangeCodeOnce('good', exchange),
    ])
    expect(calls).toBe(1)
    expect(first).toEqual({ errorMessage: null })
    expect(second).toBe(first)
    const failed = await exchangeCodeOnce('bad', exchange)
    expect(calls).toBe(2)
    expect(failed.errorMessage).toMatch(/expired/)
  })
})