import { routerBasename } from '../lib/config'

const storageKey = 'harbour-after-login'
const maxAgeMs = 60 * 60 * 1000

export function rememberReturnPath(): void {
  const base = routerBasename
  const path = window.location.pathname.startsWith(base)
    ? window.location.pathname.slice(base.length) || '/'
    : '/'
  const target = `${path}${window.location.search}`
  const pathOnly = path.split('?')[0] ?? path
  if (pathOnly === '/signin' || pathOnly.startsWith('/signin/')) return
  if (target === '/' || target.startsWith('//') || target.includes('code=')) return
  sessionStorage.setItem(storageKey, JSON.stringify({ path: target, at: Date.now() }))
}

export function consumeReturnPath(): string | null {
  const raw = sessionStorage.getItem(storageKey)
  sessionStorage.removeItem(storageKey)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as { path?: unknown; at?: unknown }
    if (typeof parsed.path !== 'string' || typeof parsed.at !== 'number') return null
    if (Date.now() - parsed.at > maxAgeMs) return null
    if (!parsed.path.startsWith('/') || parsed.path.startsWith('//') || parsed.path.includes('://')) return null
    if (parsed.path === '/signin' || parsed.path.startsWith('/signin?') || parsed.path.startsWith('/signin/')) return null
    return parsed.path
  } catch {
    return null
  }
}
