import { categoryLabel } from '../domain/labels'

export const siteOrigin = 'https://harieshwar-ai.github.io'
export const sitePath = '/deal-tracker/'
export const defaultTitle = 'Harbour'
export const defaultDescription = 'Harbour is a personal price watch for Hamilton, Ontario. Canadian store prices in CAD.'
export const ogImage = `${siteOrigin}${sitePath}og.jpg`

export interface ShareMeta {
  title: string
  description: string
  url: string
  image: string
}

export function itemShare(item: {
  id: string
  name: string
  public_summary: string | null
  category: string | null
}): ShareMeta {
  const name = item.name.trim() || 'Item'
  const summary = item.public_summary?.trim()
  const description = clip(summary || (item.category ? `${name}. ${categoryLabel(item.category)}.` : `${name} on Harbour.`))
  return {
    title: `${name} · Harbour`,
    description,
    url: `${siteOrigin}${sitePath}items/${encodeURIComponent(item.id)}/`,
    image: ogImage,
  }
}

export function defaultShare(): ShareMeta {
  return {
    title: defaultTitle,
    description: defaultDescription,
    url: `${siteOrigin}${sitePath}`,
    image: ogImage,
  }
}

export function metaBlock(meta: ShareMeta): string {
  return [
    `<title>${escapeHtml(meta.title)}</title>`,
    `<meta name="description" content="${escapeHtml(meta.description)}" />`,
    `<meta property="og:title" content="${escapeHtml(meta.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(meta.description)}" />`,
    `<meta property="og:image" content="${escapeHtml(meta.image)}" />`,
    `<meta property="og:url" content="${escapeHtml(meta.url)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
  ].join('\n    ')
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;'
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '"':
        return '&quot;'
      case "'":
        return '&#39;'
      default:
        return char
    }
  })
}

function clip(value: string): string {
  const trimmed = value.replace(/\s+/g, ' ').trim()
  if (trimmed.length <= 200) return trimmed
  return `${trimmed.slice(0, 197)}...`
}
