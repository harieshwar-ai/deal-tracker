import { safeHttpUrl } from './format'
import { formatRequirementLines, formatSpecLines, parseRequirementLines, parseSpecLines } from './specs'
import type {
  FieldError,
  Item,
  ItemDraft,
  ItemWrite,
  ParseResult,
  Store,
  StoreDraft,
  StoreWrite,
} from './types'

const PRICE = /^(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/

export function blankItemDraft(): ItemDraft {
  return {
    name: '',
    publicSummary: '',
    description: '',
    category: '',
    keywords: '',
    targetPrice: '',
    maxPrice: '',
    priority: 'normal',
    condition: 'new',
    notes: '',
    imageUrl: '',
    specs: '',
    requirements: '',
    active: true,
  }
}

export function blankStoreDraft(): StoreDraft {
  return {
    name: '',
    baseUrl: '',
    country: 'CA',
    membership: '',
    notes: '',
    enabled: true,
  }
}

export function itemToDraft(item: Item): ItemDraft {
  return {
    name: item.name,
    publicSummary: item.public_summary ?? '',
    description: item.description ?? '',
    category: item.category ?? '',
    keywords: item.keywords.join(', '),
    targetPrice: item.target_price == null ? '' : item.target_price.toFixed(2),
    maxPrice: item.max_price == null ? '' : item.max_price.toFixed(2),
    priority: item.priority,
    condition: item.condition ?? 'new',
    notes: item.notes ?? '',
    imageUrl: item.image_url ?? '',
    specs: formatSpecLines(item.specs),
    requirements: formatRequirementLines(item.requirements),
    active: item.active,
  }
}

export function storeToDraft(store: Store): StoreDraft {
  return {
    name: store.name,
    baseUrl: store.base_url ?? '',
    country: store.country ?? 'CA',
    membership: store.membership ?? '',
    notes: store.notes ?? '',
    enabled: store.enabled,
  }
}

export function parseItemDraft(draft: ItemDraft): ParseResult<ItemWrite> {
  const errors: FieldError[] = []
  const name = requiredText(draft.name, 'name', 'Name', 160, errors)
  const publicSummary = optionalText(draft.publicSummary, 'publicSummary', 500, errors)
  const description = optionalText(draft.description, 'description', 4000, errors)
  const category = optionalText(draft.category, 'category', 80, errors)
  const notes = optionalText(draft.notes, 'notes', 4000, errors)
  const imageUrl = parseImageUrl(draft.imageUrl, errors)
  const specs = parseSpecField(draft.specs, errors)
  const requirements = parseRequirementField(draft.requirements, errors)
  const condition = optionalText(draft.condition, 'condition', 40, errors) ?? 'new'
  const target = parsePrice(draft.targetPrice, 'targetPrice', errors)
  const max = parsePrice(draft.maxPrice, 'maxPrice', errors)
  const keywords = parseKeywords(draft.keywords, errors)
  if (errors.length > 0 || !name) return { ok: false, errors }
  return {
    ok: true,
    value: {
      name,
      public_summary: publicSummary,
      description,
      category,
      keywords,
      target_price: target,
      max_price: max,
      priority: draft.priority,
      condition,
      notes,
      image_url: imageUrl,
      specs,
      requirements,
      active: draft.active,
    },
  }
}

export function parseStoreDraft(draft: StoreDraft): ParseResult<StoreWrite> {
  const errors: FieldError[] = []
  const name = requiredText(draft.name, 'name', 'Name', 120, errors)
  const country = optionalText(draft.country, 'country', 40, errors) ?? 'CA'
  const membership = optionalText(draft.membership, 'membership', 80, errors)
  const notes = optionalText(draft.notes, 'notes', 4000, errors)
  const baseUrl = parseUrl(draft.baseUrl, errors)
  if (errors.length > 0 || !name) return { ok: false, errors }
  return {
    ok: true,
    value: {
      name,
      base_url: baseUrl,
      country,
      membership,
      notes,
      enabled: draft.enabled,
    },
  }
}

export function fieldError(errors: FieldError[], field: string): string | undefined {
  return errors.find((error) => error.field === field)?.message
}

function requiredText(
  value: string,
  field: string,
  label: string,
  max: number,
  errors: FieldError[],
): string | null {
  const trimmed = value.trim()
  if (!trimmed) {
    errors.push({ field, message: `${label} is required.` })
    return null
  }
  if (trimmed.length > max) {
    errors.push({ field, message: `${label} must be ${max} characters or fewer.` })
    return null
  }
  return trimmed
}

function optionalText(value: string, field: string, max: number, errors: FieldError[]): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.length > max) {
    errors.push({ field, message: `Keep this to ${max} characters or fewer.` })
    return null
  }
  return trimmed
}

function parsePrice(value: string, field: string, errors: FieldError[]): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (!PRICE.test(trimmed)) {
    errors.push({ field, message: 'Use a CAD amount with up to two decimals.' })
    return null
  }
  return Number(trimmed)
}

function parseKeywords(value: string, errors: FieldError[]): string[] {
  const parts = value.split(',').map((part) => part.trim()).filter(Boolean)
  const seen = new Set<string>()
  const keywords: string[] = []
  for (const part of parts) {
    if (part.length > 40) {
      errors.push({ field: 'keywords', message: 'Each keyword must be 40 characters or fewer.' })
      return []
    }
    const key = part.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    keywords.push(part)
  }
  if (keywords.length > 24) {
    errors.push({ field: 'keywords', message: 'Use 24 keywords or fewer.' })
    return []
  }
  return keywords
}

function parseSpecField(value: string, errors: FieldError[]): { name: string; value: string }[] {
  const parsed = parseSpecLines(value)
  if (!parsed.ok) {
    errors.push({ field: 'specs', message: parsed.message })
    return []
  }
  return parsed.specs
}

function parseRequirementField(value: string, errors: FieldError[]): { label: string }[] {
  const parsed = parseRequirementLines(value)
  if (!parsed.ok) {
    errors.push({ field: 'requirements', message: parsed.message })
    return []
  }
  return parsed.requirements
}

function parseImageUrl(value: string, errors: FieldError[]): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.length > 500) {
    errors.push({ field: 'imageUrl', message: 'That image address is too long.' })
    return null
  }
  const safe = safeHttpUrl(trimmed)
  if (!safe) {
    errors.push({ field: 'imageUrl', message: 'Use an http or https image address.' })
    return null
  }
  return safe
}

function parseUrl(value: string, errors: FieldError[]): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.length > 500) {
    errors.push({ field: 'baseUrl', message: 'That URL is too long.' })
    return null
  }
  const safe = safeHttpUrl(trimmed)
  if (!safe) {
    errors.push({ field: 'baseUrl', message: 'Use an http or https URL.' })
    return null
  }
  return safe
}
