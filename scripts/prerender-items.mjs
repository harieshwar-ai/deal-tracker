import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

// Mirrors src/lib/share.ts. This file stays plain JS so the Vite build can run it.
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ieohjxtkoiphewcfttuw.supabase.co'
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_cCOwmMlsyhGR1lEf-S8rMg_DRBN6ny6'
const siteOrigin = 'https://harieshwar-ai.github.io'
const sitePath = '/deal-tracker/'
const ogImage = `${siteOrigin}${sitePath}og.jpg`

export async function prerenderItems(distDir) {
  const indexPath = path.join(distDir, 'index.html')
  const html = readFileSync(indexPath, 'utf8')
  const start = html.indexOf('<!-- harbour-meta:start -->')
  const end = html.indexOf('<!-- harbour-meta:end -->')
  if (start < 0 || end < start) {
    console.warn('Harbour meta markers missing; item pages keep the default preview.')
    return 0
  }
  const response = await fetch(
    `${supabaseUrl}/rest/v1/items?select=id,name,public_summary,category`,
    {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    },
  )
  if (!response.ok) {
    console.warn(`Item prerender skipped (${response.status}). The default preview still ships.`)
    return 0
  }
  const items = await response.json()
  if (!Array.isArray(items)) return 0
  let written = 0
  for (const item of items) {
    if (!item || typeof item.id !== 'string' || typeof item.name !== 'string') continue
    if (!/^[0-9a-zA-Z-]+$/.test(item.id)) continue
    const meta = itemMeta(item)
    const next = `${html.slice(0, start)}${metaBlock(meta)}${html.slice(end + '<!-- harbour-meta:end -->'.length)}`
    const dir = path.join(distDir, 'items', item.id)
    mkdirSync(dir, { recursive: true })
    writeFileSync(path.join(dir, 'index.html'), next)
    written += 1
  }
  console.log(`Prerendered ${written} item page${written === 1 ? '' : 's'}.`)
  return written
}

function itemMeta(item) {
  const name = item.name.trim() || 'Item'
  const summary = typeof item.public_summary === 'string' ? item.public_summary.trim() : ''
  const category = typeof item.category === 'string' ? item.category.trim() : ''
  const description = clip(summary || (category ? `${name}. ${category}.` : `${name} on Harbour.`))
  return {
    title: `${name} · Harbour`,
    description,
    url: `${siteOrigin}${sitePath}items/${encodeURIComponent(item.id)}/`,
    image: ogImage,
  }
}

function metaBlock(meta) {
  return [
    '<!-- harbour-meta:start -->',
    `    <title>${escapeHtml(meta.title)}</title>`,
    `    <meta name="description" content="${escapeHtml(meta.description)}" />`,
    `    <meta property="og:title" content="${escapeHtml(meta.title)}" />`,
    `    <meta property="og:description" content="${escapeHtml(meta.description)}" />`,
    `    <meta property="og:image" content="${escapeHtml(meta.image)}" />`,
    `    <meta property="og:url" content="${escapeHtml(meta.url)}" />`,
    `    <meta property="og:type" content="website" />`,
    `    <meta name="twitter:card" content="summary_large_image" />`,
    '    <!-- harbour-meta:end -->',
  ].join('\n')
}

function escapeHtml(value) {
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

function clip(value) {
  const trimmed = value.replace(/\s+/g, ' ').trim()
  if (trimmed.length <= 200) return trimmed
  return `${trimmed.slice(0, 197)}...`
}
