import { assignProducts, listingKey, parseOfferName } from './identity'
import { capturedTime } from './quotes'
import type { Deal, PriceSnapshot, Verdict, VerdictGroup } from './types'

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

export interface DealOption {
  label: string | null
  price: number
  url: string | null
}

export interface DealCluster {
  deal: Deal
  options: DealOption[]
}

export interface DealGroup {
  verdict: VerdictGroup
  deals: Deal[]
}

export function clusterDeals(deals: Deal[], snapshots: PriceSnapshot[]): DealCluster[] {
  const assignments = assignProducts(snapshots)
  const buckets = new Map<string, Deal[]>()
  for (const deal of deals) {
    const key = dealClusterKey(deal, snapshots, assignments)
    const list = buckets.get(key) ?? []
    list.push(deal)
    buckets.set(key, list)
  }
  return [...buckets.values()].map((group) => {
    const deal = group.reduce((best, candidate) => preferDeal(candidate, best, snapshots) ? candidate : best)
    return {
      deal,
      options: group
        .map((entry) => ({ label: parseOfferName(entry.title).variantLabel, price: entry.price, url: entry.url }))
        .sort((left, right) => left.price - right.price || (left.label ?? '').localeCompare(right.label ?? '')),
    }
  })
}

function dealClusterKey(deal: Deal, snapshots: PriceSnapshot[], assignments: ReturnType<typeof assignProducts>): string {
  const store = deal.store_id ?? ''
  if (deal.snapshot_id != null) {
    const assigned = assignments.get(deal.snapshot_id)
    if (assigned && !assigned.unnamed) return `${deal.item_id}\u0000${store}\u0000${assigned.productKey}`
  }
  const listing = listingKey(deal.url)
  if (listing) {
    for (const snapshot of snapshots) {
      if (snapshot.item_id !== deal.item_id) continue
      if (listingKey(snapshot.product_url) !== listing) continue
      const assigned = assignments.get(snapshot.id)
      if (assigned && !assigned.unnamed) return `${deal.item_id}\u0000${store}\u0000${assigned.productKey}`
    }
  }
  const parsed = parseOfferName(deal.title)
  if (parsed.identityKey && parsed.identityTokens >= 2) return `${deal.item_id}\u0000${store}\u0000${parsed.identityKey}`
  if (parsed.exactKey) return `${deal.item_id}\u0000${store}\u0000exact:${parsed.exactKey}`
  return `deal:${deal.id}`
}

function linkedInStock(deal: Deal, snapshots: PriceSnapshot[]): boolean {
  if (deal.snapshot_id == null) return true
  const snapshot = snapshots.find((entry) => entry.id === deal.snapshot_id)
  if (!snapshot) return true
  return snapshot.in_stock !== false
}

function preferDeal(candidate: Deal, current: Deal, snapshots: PriceSnapshot[]): boolean {
  const candidateStock = linkedInStock(candidate, snapshots)
  const currentStock = linkedInStock(current, snapshots)
  if (candidateStock !== currentStock) return candidateStock
  const rank = verdictRank(candidate.verdict) - verdictRank(current.verdict)
  if (rank !== 0) return rank < 0
  if (candidate.price !== current.price) return candidate.price < current.price
  const score = (candidate.score ?? -1) - (current.score ?? -1)
  if (score !== 0) return score > 0
  return capturedTime(candidate.found_at) > capturedTime(current.found_at)
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
