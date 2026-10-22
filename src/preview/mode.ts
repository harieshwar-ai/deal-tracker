const previewKey = 'harbour-preview'
const ownerKey = 'harbour-preview-owner'

export function enablePreviewFromUrl(): void {
  if (!import.meta.env.DEV) return
  const params = new URLSearchParams(window.location.search)
  if (params.has('preview')) sessionStorage.setItem(previewKey, '1')
  if (params.has('owner') && (params.has('preview') || sessionStorage.getItem(previewKey) === '1')) {
    sessionStorage.setItem(ownerKey, '1')
  }
}

export function previewRequested(): boolean {
  if (!import.meta.env.DEV) return false
  return sessionStorage.getItem(previewKey) === '1'
}

export function previewOwnerRequested(): boolean {
  if (!import.meta.env.DEV) return false
  return previewRequested() && sessionStorage.getItem(ownerKey) === '1'
}

export function leavePreview(): void {
  sessionStorage.removeItem(previewKey)
  sessionStorage.removeItem(ownerKey)
  const url = new URL(window.location.href)
  url.searchParams.delete('preview')
  url.searchParams.delete('owner')
  window.location.assign(url.toString())
}
