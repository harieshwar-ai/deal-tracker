import type { PriceSnapshot } from './types'

export function isQualifying(snapshot: PriceSnapshot): boolean {
  return snapshot.meets_requirements === true
}

export function requirementLabel(value: boolean | null): string | null {
  if (value === true) return null
  if (value === false) return "Doesn't meet specs"
  return 'Unverified'
}
