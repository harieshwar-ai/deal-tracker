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
    return 'That sign-in link has expired. Sign in with the owner email and password.'
  }
  if (description) return description
  return 'The sign-in link was rejected. Sign in with the owner email and password.'
}

export function explainAuthFailure(error: AuthFailure): string {
  if (error.name === 'AuthPKCECodeVerifierMissingError' || error.code === 'pkce_code_verifier_not_found') {
    return 'This browser did not request that link, so it cannot finish here. Sign in with the owner email and password.'
  }
  if (/invalid login credentials|invalid email or password/i.test(error.message)) {
    return 'That email or password does not match the Harbour owner account.'
  }
  if (error.status === 429 || error.code === 'over_request_rate_limit' || /rate limit/i.test(error.message)) {
    return 'Sign-in is temporarily limited. Wait a moment, then try the email and password again.'
  }
  if (error.code === 'otp_expired' || /expired|invalid/i.test(error.message)) {
    return 'That sign-in link is invalid or has expired. Sign in with the owner email and password.'
  }
  if (/signups not allowed|user not found/i.test(error.message)) {
    return 'That email is not the Harbour account. Only the owner can sign in.'
  }
  return error.message
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

function blankToNull(value: string | null): string | null {
  if (value == null) return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}
