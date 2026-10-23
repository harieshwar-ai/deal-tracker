import { useState } from 'react'
import { safeHttpUrl } from '../domain/format'

const markTones = [
  'bg-pine-soft text-pine',
  'bg-sea-soft text-sea',
  'bg-gold-soft text-gold',
  'bg-clay-soft text-clay',
]

export function StoreMark({ name }: { name: string }) {
  const tone = markTones[markIndex(name) % markTones.length] ?? markTones[0]
  return (
    <span className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${tone}`} aria-hidden="true">
      {initials(name)}
    </span>
  )
}

export function ProductPhoto({ name, imageUrl }: { name: string; imageUrl: string | null }) {
  const src = safeHttpUrl(imageUrl)
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  if (!src || failedSrc === src) {
    return (
      <div className="flex h-full min-h-28 items-center justify-center bg-paper text-3xl font-semibold text-pine" aria-hidden="true">
        {initials(name)}
      </div>
    )
  }
  return (
    <img
      src={src}
      alt=""
      className="h-full min-h-28 w-full object-cover"
      onError={() => setFailedSrc(src)}
    />
  )
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  const letters = words.length >= 2
    ? `${words[0]?.[0] ?? ''}${words[1]?.[0] ?? ''}`
    : (words[0] ?? '?').slice(0, 2)
  return letters.toUpperCase()
}

function markIndex(name: string): number {
  let hash = 0
  for (const char of name) hash = (hash + char.charCodeAt(0)) % 4
  return hash
}
