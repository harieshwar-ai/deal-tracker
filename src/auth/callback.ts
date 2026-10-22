export interface AuthCallback {
  code: string | null
  error: string | null
  errorCode: string | null
  errorDescription: string | null
}

export interface AuthFailure {
  message: string
  status?: number
  code?: string
  name?: string
}

const authParamNames = ['code', 'error', 'error_code', 'error_description', 'sb_flow_id'] as const

const sendCooldownMs = 60_000
const rateLimitCooldownMs = 30 * 60 * 1000

export function readAuthCallback(search: string): AuthCallback {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  return {
    code: blankToNull(params.get('code')),
    error: blankToNull(params.get('error')),
    errorCode: blankToNull(params.get('error_code')),
    errorDescription: blankToNull(params.get('error_description')),
  }
}

export function hasAuthCallback(search: string): boolean {
  const callback = readAuthCallback(search)
  return Boolean(callback.code || callback.error || callback.errorCode || callback.errorDescription)
}

let capturedCallback: { message: string | null; code: string | null } | null = null

export function resetCapturedCallbackForTests(): void {
  capturedCallback = null
}

export function captureAuthCallback(search: string): { message: string | null; code: string | null } {
  const callback = readAuthCallback(search)
  if (hasAuthCallback(search)) {
    capturedCallback = { message: friendlyCallbackMessage(callback), code: callback.code }
  }
  return capturedCallback ?? { message: null, code: null }
}

export function friendlyCallbackMessage(callback: AuthCallback): string | null {
  if (!callback.error && !callback.errorCode && !callback.errorDescription) return null
  const code = callback.errorCode ?? callback.error ?? ''
  const description = callback.errorDescription ?? ''
  if (code === 'otp_expired' || /expired/i.test(description)) {
    return 'That sign-in link has expired. Request a new email, then open the link in this browser or enter the 6-digit code.'
  }
  if (description) return description
  return 'The sign-in link was rejected. Request a new email and try again.'
}

export function explainAuthFailure(error: AuthFailure): string {
  if (error.name === 'AuthPKCECodeVerifierMissingError' || error.code === 'pkce_code_verifier_not_found') {
    return 'This browser did not request that magic link, so the link cannot finish here. Enter the 6-digit code from the same email.'
  }
  if (/invalid login credentials|invalid email or password/i.test(error.message)) {
    return 'That email or password does not match the Harbour owner account.'
  }
  if (error.status === 429 || error.code === 'over_request_rate_limit' || /rate limit/i.test(error.message)) {
    return `Supabase is limiting email right now. The free mailer allows about two emails an hour. ${error.message}`
  }
  if (error.code === 'otp_expired' || /expired|invalid/i.test(error.message)) {
    return 'That code or link is invalid or has expired. Request a new email, then use the new link or the new 6-digit code.'
  }
  if (/signups not allowed|user not found/i.test(error.message)) {
    return 'That email is not the Harbour account. Only the owner can sign in.'
  }
  return error.message
}

export function waitUntilAfterSend(error: AuthFailure | null, now: number): number {
  if (!error) return now + sendCooldownMs
  const seconds = error.message.match(/after (\d+) second/i)
  if (seconds) return now + Number(seconds[1]) * 1000
  if (error.status === 429 || error.code === 'over_request_rate_limit' || /rate limit/i.test(error.message)) {
    return now + rateLimitCooldownMs
  }
  return now + sendCooldownMs
}

export function stripAuthSearch(search: string): string {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  for (const name of authParamNames) params.delete(name)
  const next = params.toString()
  return next ? `?${next}` : ''
}

export function replaceAuthCallbackUrl(): void {
  const url = new URL(window.location.href)
  const nextSearch = stripAuthSearch(url.search)
  if (nextSearch === (url.search === '?' ? '' : url.search)) return
  window.history.replaceState(window.history.state, '', `${url.pathname}${nextSearch}${url.hash}`)
}

const waitKey = 'harbour-magic-link-wait-until'

export function readWaitUntil(storage: Pick<Storage, 'getItem'>): number | null {
  const raw = storage.getItem(waitKey)
  if (!raw) return null
  const value = Number(raw)
  return Number.isFinite(value) ? value : null
}

export function rememberWaitUntil(storage: Pick<Storage, 'setItem'>, until: number): void {
  storage.setItem(waitKey, String(until))
}

export function remainingCooldown(until: number | null, now: number): number {
  if (until == null) return 0
  return Math.max(0, until - now)
}

function blankToNull(value: string | null): string | null {
  if (value == null) return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}
