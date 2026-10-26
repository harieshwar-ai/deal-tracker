import type { DatePreset, DealStatus, Priority, Verdict, VerdictGroup, WatchSort } from './types'

/** Stored on alert_subscriptions.category. Not an items.category value. */
export const PC_HARDWARE_GROUP = 'group:pc-hardware'

export const PC_HARDWARE_MEMBERS = ['Prebuilt PCs', 'Graphics cards', 'Memory (RAM)', 'SSDs'] as const

const categoryLabels: Record<string, string> = {
  'prebuilt-pc': 'Prebuilt PCs',
  prebuilt: 'Prebuilt PCs',
  'gaming-pc': 'Prebuilt PCs',
  gpu: 'Graphics cards',
  'graphics-card': 'Graphics cards',
  'graphics-cards': 'Graphics cards',
  ram: 'Memory (RAM)',
  memory: 'Memory (RAM)',
  ssd: 'SSDs',
  ssds: 'SSDs',
  nvme: 'SSDs',
  chairs: 'Chairs',
  chair: 'Chairs',
}

const categoryAcronyms: Record<string, string> = {
  pc: 'PC',
  pcs: 'PCs',
  gpu: 'GPU',
  ram: 'RAM',
  ssd: 'SSD',
  ssds: 'SSDs',
  nvme: 'NVMe',
  cpu: 'CPU',
  hdd: 'HDD',
}

/** Display name. Readable stored values pass through. Only legacy slugs are rewritten. */
export function categoryLabel(category: string | null | undefined): string {
  const raw = (category ?? '').trim().replace(/\s+/g, ' ')
  if (!raw) return 'Uncategorized'
  if (raw === PC_HARDWARE_GROUP) return 'All PC hardware'
  if (/[A-Z]/.test(raw) || raw.includes(' ') || raw.includes('(')) return raw
  const known = categoryLabels[raw.toLowerCase()]
  if (known) return known
  return raw
    .toLowerCase()
    .split(/[-_]/)
    .filter(Boolean)
    .map((word) => categoryAcronyms[word] ?? `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(' ')
}

export function isPcHardwareMember(category: string | null | undefined): boolean {
  const raw = (category ?? '').trim()
  return (PC_HARDWARE_MEMBERS as readonly string[]).includes(raw)
}

/** Subscription categories that should receive an alert for this item category. */
export function alertMatchCategories(itemCategory: string | null | undefined): string[] {
  const category = (itemCategory ?? '').trim()
  if (!category) return []
  return isPcHardwareMember(category) ? [category, PC_HARDWARE_GROUP] : [category]
}

export function pcHardwareGroupAvailable(categories: readonly string[]): boolean {
  return categories.some((category) => isPcHardwareMember(category))
}

export function alertCategoryGroups(categories: readonly string[]): { label: string; options: { value: string; label: string }[] }[] {
  const known = categories.filter((category) => category && category !== 'Uncategorized' && category !== PC_HARDWARE_GROUP)
  const groups: { label: string; options: { value: string; label: string }[] }[] = []
  if (pcHardwareGroupAvailable(known)) {
    groups.push({
      label: 'Groups',
      options: [{ value: PC_HARDWARE_GROUP, label: categoryLabel(PC_HARDWARE_GROUP) }],
    })
  }
  if (known.length > 0) {
    groups.push({
      label: 'Categories',
      options: known.map((entry) => ({ value: entry, label: categoryLabel(entry) })),
    })
  }
  return groups
}

export function priorityLabel(priority: Priority): string {
  switch (priority) {
    case 'low':
      return 'Low'
    case 'normal':
      return 'Normal'
    case 'high':
      return 'High'
    default: {
      const neverPriority: never = priority
      return neverPriority
    }
  }
}

export function dealScoreLabel(verdict: Verdict | null): string {
  return `Deal score: ${verdictLabel(verdict ?? 'unrated').toLowerCase()}`
}

export function verdictLabel(verdict: VerdictGroup): string {
  switch (verdict) {
    case 'must_buy':
      return 'Must buy'
    case 'good':
      return 'Good'
    case 'ok':
      return 'OK'
    case 'skip':
      return 'Skip'
    case 'unrated':
      return 'Unrated'
    default: {
      const neverVerdict: never = verdict
      return neverVerdict
    }
  }
}

export function statusLabel(status: DealStatus): string {
  switch (status) {
    case 'open':
      return 'Open'
    case 'bought':
      return 'Bought'
    case 'dismissed':
      return 'Dismissed'
    case 'expired':
      return 'Expired'
    default: {
      const neverStatus: never = status
      return neverStatus
    }
  }
}

export function presetLabel(preset: DatePreset): string {
  switch (preset) {
    case '30d':
      return '30 days'
    case '90d':
      return '90 days'
    case '365d':
      return 'Year'
    case 'all':
      return 'All time'
    default: {
      const neverPreset: never = preset
      return neverPreset
    }
  }
}

export function periodPhrase(preset: DatePreset): string {
  switch (preset) {
    case '30d':
      return 'the last 30 days'
    case '90d':
      return 'the last 90 days'
    case '365d':
      return 'the last year'
    case 'all':
      return 'all saved prices'
    default: {
      const neverPreset: never = preset
      return neverPreset
    }
  }
}

export function sortLabel(sort: WatchSort): string {
  switch (sort) {
    case 'target_gap':
      return 'Under target'
    case 'price_asc':
      return 'Lowest price'
    case 'priority':
      return 'Priority'
    case 'name':
      return 'Name'
    case 'updated':
      return 'Recently updated'
    default: {
      const neverSort: never = sort
      return neverSort
    }
  }
}

export function priorityRank(priority: Priority): number {
  switch (priority) {
    case 'high':
      return 0
    case 'normal':
      return 1
    case 'low':
      return 2
    default: {
      const neverPriority: never = priority
      return neverPriority
    }
  }
}

export function verdictTone(verdict: VerdictGroup): string {
  switch (verdict) {
    case 'must_buy':
      return 'bg-buy text-on-buy'
    case 'good':
      return 'bg-good-soft text-good'
    case 'ok':
      return 'bg-sea-soft text-sea'
    case 'skip':
      return 'bg-skip-soft text-skip'
    case 'unrated':
      return 'bg-paper text-muted'
    default: {
      const neverVerdict: never = verdict
      return neverVerdict
    }
  }
}

export function priorityTone(priority: Priority): string {
  switch (priority) {
    case 'high':
      return 'bg-clay-soft font-semibold text-clay'
    case 'normal':
      return 'bg-pine-soft text-pine'
    case 'low':
      return 'bg-paper text-muted'
    default: {
      const neverPriority: never = priority
      return neverPriority
    }
  }
}

export function verdictChartColor(verdict: VerdictGroup): string {
  switch (verdict) {
    case 'must_buy':
      return '#0d6b3c'
    case 'good':
      return '#0b5e4a'
    case 'ok':
      return '#1a4a80'
    case 'skip':
      return '#7a3a48'
    case 'unrated':
      return '#4a5563'
    default: {
      const neverVerdict: never = verdict
      return neverVerdict
    }
  }
}
