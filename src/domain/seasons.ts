import { formatDay } from './format'

export interface SeasonCard {
  id: 'black-friday' | 'boxing-day' | 'prime-day'
  name: string
  when: string
  days: number | null
  detail: string
}

export interface GuidanceRange {
  category: string
  range: string
}

export const guidanceRanges: GuidanceRange[] = [
  { category: 'Electronics', range: 'about 15–40% off' },
  { category: 'Furniture', range: 'about 10–30% off' },
  { category: 'Appliances', range: 'about 10–30% off' },
  { category: 'Grocery', range: 'about 5–20% off' },
]

const guidance = 'General guidance, not a price saved in Harbour.'

export function seasonCards(now = new Date()): SeasonCard[] {
  const today = torontoParts(now)
  const friday = upcoming(today, blackFriday)
  const boxing = upcoming(today, (year) => ({ year, month: 12, day: 26 }))
  return [
    {
      id: 'black-friday',
      name: 'Black Friday',
      when: formatParts(friday),
      days: dayGap(today, friday),
      detail: `${guidance} The Friday after US Thanksgiving.`,
    },
    {
      id: 'boxing-day',
      name: 'Boxing Day',
      when: formatParts(boxing),
      days: dayGap(today, boxing),
      detail: `${guidance} December 26 in Canada.`,
    },
    {
      id: 'prime-day',
      name: 'Prime Day',
      when: 'Usually mid-July',
      days: null,
      detail: `${guidance} Amazon has not published the next date here. Recent events have fallen in July.`,
    },
  ]
}

interface Parts {
  year: number
  month: number
  day: number
}

function upcoming(today: Parts, build: (year: number) => Parts): Parts {
  const thisYear = build(today.year)
  if (dayGap(today, thisYear) >= 0) return thisYear
  return build(today.year + 1)
}

function blackFriday(year: number): Parts {
  const thursday = nthWeekday(year, 11, 4, 4)
  return addDays(thursday, 1)
}

function nthWeekday(year: number, month: number, weekday: number, n: number): Parts {
  const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
  const day = 1 + ((weekday - first + 7) % 7) + (n - 1) * 7
  return { year, month, day }
}

function addDays(parts: Parts, days: number): Parts {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days))
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() }
}

function dayGap(from: Parts, to: Parts): number {
  const start = Date.UTC(from.year, from.month - 1, from.day)
  const end = Date.UTC(to.year, to.month - 1, to.day)
  return Math.round((end - start) / 86400000)
}

function formatParts(parts: Parts): string {
  return formatDay(new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 16)).toISOString())
}

function torontoParts(now: Date): Parts {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const year = Number(parts.find((part) => part.type === 'year')?.value)
  const month = Number(parts.find((part) => part.type === 'month')?.value)
  const day = Number(parts.find((part) => part.type === 'day')?.value)
  return { year, month, day }
}
