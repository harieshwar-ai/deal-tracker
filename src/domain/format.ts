const TIME_ZONE = 'America/Toronto'

const cadFormatter = new Intl.NumberFormat('en-CA', {
  style: 'currency',
  currency: 'CAD',
})

const dayKeyFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const dayLabelFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: 'short',
  day: 'numeric',
})

const axisFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  month: 'short',
  day: 'numeric',
})

export function formatCad(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return cadFormatter.format(value)
}

export function formatPct(value: number | null | undefined, digits = 0): string {
  if (value == null || !Number.isFinite(value)) return '—'
  const formatted = new Intl.NumberFormat('en-CA', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)
  return `${formatted}%`
}

export function formatDay(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return dayLabelFormatter.format(date)
}

export function formatAxisDay(day: string): string {
  const date = new Date(`${day}T16:00:00.000Z`)
  if (Number.isNaN(date.getTime())) return day
  return axisFormatter.format(date)
}

const torontoFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  dateStyle: 'medium',
  timeStyle: 'short',
})

export function formatToronto(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return `${torontoFormatter.format(date)} ET`
}

export function formatRelative(iso: string, now = Date.now()): string {
  const time = Date.parse(iso)
  if (Number.isNaN(time)) return '—'
  const minutes = Math.round((now - time) / 60000)
  if (minutes < 0) return formatDay(iso)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 45) return `${days}d ago`
  return formatDay(iso)
}

export function dayKey(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return dayKeyFormatter.format(date)
}

export function toCents(value: number): number {
  return Math.round(value * 100)
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

export function discountPercent(price: number, regular: number | null): number | null {
  if (regular == null || regular <= 0) return null
  return ((regular - price) / regular) * 100
}

export function safeHttpUrl(value: string | null | undefined): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    if (url.protocol === 'https:' || url.protocol === 'http:') return url.toString()
    return null
  } catch {
    return null
  }
}

export function categoryKey(category: string | null | undefined): string {
  const trimmed = category?.trim()
  return trimmed ? trimmed : 'Uncategorized'
}

export function isCadCurrency(currency: string | null | undefined): boolean {
  return (currency ?? '').toUpperCase() === 'CAD'
}

export function moneyInput(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return ''
  return value.toFixed(2)
}
