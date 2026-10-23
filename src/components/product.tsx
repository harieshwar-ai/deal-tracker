import { Armchair, Car, House, Monitor, Package, ShoppingBasket } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
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

export function ProductPhoto({
  name,
  imageUrl,
  category = null,
}: {
  name: string
  imageUrl: string | null
  category?: string | null
}) {
  const src = safeHttpUrl(imageUrl)
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  if (!src || failedSrc === src) {
    const Icon = categoryIcon(category)
    return (
      <div className="flex h-full min-h-28 items-center justify-center bg-gradient-to-br from-pine-soft via-paper-2 to-sea-soft text-pine" aria-hidden="true" title={name}>
        <Icon className="h-8 w-8" strokeWidth={1.5} />
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

function categoryIcon(category: string | null): LucideIcon {
  const value = (category ?? '').toLowerCase()
  if (value.includes('furn') || value.includes('chair') || value.includes('sofa')) return Armchair
  if (value.includes('electronic') || value.includes('monitor') || value.includes('tv') || value.includes('computer')) return Monitor
  if (value.includes('auto') || value.includes('car') || value.includes('tire')) return Car
  if (value.includes('grocery') || value.includes('food')) return ShoppingBasket
  if (value.includes('home') || value.includes('appliance') || value.includes('kitchen')) return House
  return Package
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
