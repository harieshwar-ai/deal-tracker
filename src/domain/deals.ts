import { capturedTime } from './quotes'
import type { Deal, Verdict, VerdictGroup } from './types'

export const verdictOrder: VerdictGroup[] = ['must_buy', 'good', 'ok', 'skip', 'unrated']

export function verdictGroup(verdict: Verdict | null): VerdictGroup {
  if (verdict == null) return 'unrated'
  switch (verdict) {
    case 'must_buy':
    case 'good':
    case 'ok':
    case 'skip':
      return verdict
    default: {
      const neverVerdict: never = verdict
      return neverVerdict
    }
  }
}

function verdictRank(verdict: Verdict | null): number {
  switch (verdict) {
    case 'must_buy':
      return 0
    case 'good':
      return 1
    case 'ok':
      return 2
    case 'skip':
      return 3
    case null:
      return 4
    default: {
      const neverVerdict: never = verdict
      return neverVerdict
    }
  }
}

export function pickOpenDeal(deals: Deal[]): Deal | null {
  const open = deals.filter((deal) => deal.status === 'open')
  open.sort((left, right) => {
    const rankDelta = verdictRank(left.verdict) - verdictRank(right.verdict)
    if (rankDelta !== 0) return rankDelta
    const scoreDelta = (right.score ?? -1) - (left.score ?? -1)
    if (scoreDelta !== 0) return scoreDelta
    return capturedTime(right.found_at) - capturedTime(left.found_at)
  })
  return open[0] ?? null
}

export interface DealGroup {
  verdict: VerdictGroup
  deals: Deal[]
}

export function groupDeals(deals: Deal[]): DealGroup[] {
  const buckets = new Map<VerdictGroup, Deal[]>()
  for (const verdict of verdictOrder) buckets.set(verdict, [])
  for (const deal of deals) {
    const verdict = verdictGroup(deal.verdict)
    const list = buckets.get(verdict)
    if (list) list.push(deal)
  }
  for (const list of buckets.values()) {
    list.sort(
      (left, right) =>
        (right.score ?? -1) - (left.score ?? -1) || right.found_at.localeCompare(left.found_at),
    )
  }
  return verdictOrder.flatMap((verdict) => {
    const list = buckets.get(verdict) ?? []
    if (list.length === 0) return []
    return [{ verdict, deals: list }]
  })
}
