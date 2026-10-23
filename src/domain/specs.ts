import type { ItemRequirement, ItemSpec } from './types'

const stopwords = new Set(['a', 'an', 'the', 'true', 'with', 'and', 'for', 'of', 'to'])

export function requirementMet(requirement: ItemRequirement, specs: ItemSpec[]): boolean {
  const haystack = specs.map((spec) => `${spec.name} ${spec.value}`).join('\n').toLowerCase()
  const tokens = requirement.label
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 0 && !stopwords.has(token) && (token.length >= 2 || /\d/.test(token)))
  if (tokens.length === 0 || haystack.trim().length === 0) return false
  const numbers = tokens.filter((token) => /\d/.test(token))
  const words = tokens.filter((token) => !/\d/.test(token))
  if (numbers.some((token) => !hasToken(haystack, token))) return false
  if (words.length === 0) return true
  if (numbers.length > 0) return words.some((token) => hasToken(haystack, token))
  return words.every((token) => hasToken(haystack, token))
}

export function parseSpecList(value: unknown): ItemSpec[] {
  if (!Array.isArray(value)) return []
  const specs: ItemSpec[] = []
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue
    const record = entry as Record<string, unknown>
    const name = typeof record.name === 'string' ? record.name.trim() : ''
    const specValue = typeof record.value === 'string' ? record.value.trim() : ''
    if (!name || name.length > 80 || specValue.length > 200) continue
    specs.push({ name, value: specValue })
  }
  return specs.slice(0, 40)
}

export function parseRequirementList(value: unknown): ItemRequirement[] {
  if (!Array.isArray(value)) return []
  const requirements: ItemRequirement[] = []
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue
    const record = entry as Record<string, unknown>
    const label = typeof record.label === 'string' ? record.label.trim() : ''
    if (!label || label.length > 120) continue
    requirements.push({ label })
  }
  return requirements.slice(0, 40)
}

export function parseSpecLines(text: string): { ok: true; specs: ItemSpec[] } | { ok: false; message: string } {
  const specs: ItemSpec[] = []
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean)
  if (lines.length > 40) return { ok: false, message: 'Use 40 specs or fewer.' }
  for (const line of lines) {
    const splitAt = line.indexOf('|')
    if (splitAt <= 0 || splitAt === line.length - 1) {
      return { ok: false, message: 'Write each spec as Name | value.' }
    }
    const name = line.slice(0, splitAt).trim()
    const value = line.slice(splitAt + 1).trim()
    if (!name || name.length > 80 || value.length > 200) {
      return { ok: false, message: 'Keep each spec name to 80 characters and each value to 200.' }
    }
    specs.push({ name, value })
  }
  return { ok: true, specs }
}

export function parseRequirementLines(text: string): { ok: true; requirements: ItemRequirement[] } | { ok: false; message: string } {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean)
  if (lines.length > 40) return { ok: false, message: 'Use 40 requirements or fewer.' }
  for (const line of lines) {
    if (line.length > 120) return { ok: false, message: 'Keep each requirement to 120 characters.' }
  }
  return { ok: true, requirements: lines.map((label) => ({ label })) }
}

export function formatSpecLines(specs: ItemSpec[]): string {
  return specs.map((spec) => `${spec.name} | ${spec.value}`).join('\n')
}

export function formatRequirementLines(requirements: ItemRequirement[]): string {
  return requirements.map((requirement) => requirement.label).join('\n')
}

function hasToken(haystack: string, token: string): boolean {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(haystack)
}
