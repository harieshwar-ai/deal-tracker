import { useEffect } from 'react'

export function useDocumentTitle(title: string, description?: string | null): void {
  useEffect(() => {
    const nextTitle = title === 'Harbour' ? title : `${title} · Harbour`
    document.title = nextTitle
    setMeta('description', description)
    setProperty('og:title', nextTitle)
    setProperty('og:description', description)
    setProperty('og:url', window.location.href)
  }, [title, description])
}

function setMeta(name: string, content: string | null | undefined): void {
  if (!content) return
  const tag = document.querySelector(`meta[name="${name}"]`)
  if (tag) tag.setAttribute('content', content)
}

function setProperty(property: string, content: string | null | undefined): void {
  if (!content) return
  const tag = document.querySelector(`meta[property="${property}"]`)
  if (tag) tag.setAttribute('content', content)
}
