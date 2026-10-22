const previewKey = 'harbour-preview'

export function enablePreviewFromUrl(): void {
  if (!import.meta.env.DEV) return
  const params = new URLSearchParams(window.location.search)
  if (params.has('preview')) sessionStorage.setItem(previewKey, '1')
}

export function previewRequested(): boolean {
  if (!import.meta.env.DEV) return false
  return sessionStorage.getItem(previewKey) === '1'
}

export function leavePreview(): void {
  sessionStorage.removeItem(previewKey)
  const url = new URL(window.location.href)
  url.searchParams.delete('preview')
  window.location.assign(url.toString())
}
