export function writeParams(current: URLSearchParams, updates: Record<string, string | null>): URLSearchParams {
  const next = new URLSearchParams(current)
  for (const [key, value] of Object.entries(updates)) {
    if (value == null || value === '') next.delete(key)
    else next.set(key, value)
  }
  return next
}
