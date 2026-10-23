import type { PriceSnapshot } from './types'

/**
 * Same brand and model, differing only by colour, finish, edition, or size, share a product.
 * Model numbers stay in the identity (NEO vs APEX, Phantom 3 vs Phantom 4, B100 vs B300).
 * A name merges only when at least two identity tokens match, or the listing URL is the same SKU.
 * Anything uncertain stays separate.
 */
export type VariantKind = 'colour' | 'edition' | 'size' | 'finish'

export interface ClassifiedToken {
  raw: string
  norm: string
  role: 'identity' | VariantKind | 'drop'
}

export interface ParsedName {
  exactKey: string
  identityKey: string | null
  identityLabel: string | null
  variantLabel: string | null
  variantKind: VariantKind | null
  identityTokens: number
  sizeNorms: string[]
  tokens: ClassifiedToken[]
}

export interface ProductAssignment {
  productKey: string
  displayName: string | null
  optionLabel: string | null
  optionKind: VariantKind | null
  unnamed: boolean
  multiVariant: boolean
}

const colours = new Set([
  'black', 'white', 'red', 'blue', 'green', 'grey', 'gray', 'orange', 'pink', 'purple', 'brown',
  'beige', 'navy', 'quartz', 'stealth', 'lunar', 'charcoal', 'silver', 'gold', 'ivory', 'cream',
  'tan', 'burgundy', 'teal', 'yellow', 'violet', 'indigo', 'crimson', 'ebony', 'onyx', 'slate',
  'graphite', 'pearl', 'rose', 'coral', 'olive', 'walnut', 'oak', 'espresso', 'midnight', 'arctic',
  'obsidian', 'snow', 'carbon', 'camo', 'camouflage', 'bronze', 'copper', 'sand', 'khaki',
  'champagne', 'maroon', 'lilac', 'lavender', 'magenta', 'cyan', 'wine', 'cherry',
])

const sizes = new Set(['xs', 's', 'm', 'l', 'xl', 'xxl', 'xxxl', '2xl', '3xl', '4xl', 'small', 'medium', 'large', 'big', 'tall'])
const sizeCodes = new Set(['xs', 's', 'm', 'l', 'xl', 'xxl', 'xxxl', '2xl', '3xl', '4xl'])
const finishes = new Set(['pu', 'pvc', 'leather', 'fabric', 'mesh', 'epu', 'velvet', 'microsuede', 'nubuck', 'linen', 'suede', 'pleather', 'faux'])
const fluff = new Set([
  'gaming', 'game', 'gamer', 'office', 'ergonomic', 'desk', 'chair', 'chairs', 'furniture', 'premium',
  'genuine', 'swivel', 'adjustable', 'height', 'the', 'a', 'an', 'and', 'with', 'for', 'of', 'to',
  'in', 'on', 'from', 'by', 'series', 'home', 'upholstered',
])
const editionMarkers = new Set(['edition', 'colorway', 'colourway'])
const dropWords = new Set(['color', 'colour', 'finish'])

export function parseOfferName(name: string | null | undefined): ParsedName {
  const trimmed = (name ?? '').trim()
  if (!trimmed) return emptyParsed('')
  const tokens = classify(tokenize(trimmed))
  const identity = tokens.filter((token) => token.role === 'identity')
  const variants = tokens.filter((token) => token.role !== 'identity' && token.role !== 'drop')
  const identityKey = identity.length > 0 ? identity.map((token) => token.norm).join(' ') : null
  return {
    exactKey: exactKey(trimmed),
    identityKey,
    identityLabel: identity.length > 0 ? identity.map((token) => token.raw).join(' ') : null,
    variantLabel: variants.length > 0 ? variants.map((token) => token.raw).join(' ') : null,
    variantKind: kindOf(variants.map((token) => token.role as VariantKind)),
    identityTokens: identity.length,
    sizeNorms: variants.filter((token) => token.role === 'size').map((token) => token.norm),
    tokens,
  }
}

export function listingKey(url: string | null | undefined): string | null {
  const parsed = readUrl(url)
  if (!parsed) return null
  const path = parsed.pathname
  const asin = path.match(/\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})(?:[/?#]|$)/i)
  if (asin?.[1]) return `amazon:${asin[1].toUpperCase()}`
  if (isWeakPath(path)) return null
  const id = path.split('/').filter(Boolean).map((segment) => /^(\d{5,})/.exec(segment)?.[1]).find(Boolean)
  if (!id) return null
  return `${host(parsed)}/${id}`
}

export function variantHeading(kinds: Array<VariantKind | null | undefined>): string | null {
  const present = [...new Set(kinds.filter((kind): kind is VariantKind => kind != null))]
  if (present.length === 0) return null
  if (present.every((kind) => kind === 'colour' || kind === 'edition')) return 'Colours'
  if (present.every((kind) => kind === 'size')) return 'Sizes'
  if (present.every((kind) => kind === 'finish')) return 'Finishes'
  return 'Options'
}

export function assignProducts(snapshots: PriceSnapshot[]): Map<number, ProductAssignment> {
  const parsed = new Map<number, ParsedName>()
  for (const snapshot of snapshots) parsed.set(snapshot.id, parseOfferName(snapshot.product_name))
  const { find, union } = createUnion(snapshots.map((snapshot) => snapshot.id))
  const seenExact = new Map<string, number>()
  const seenIdentity = new Map<string, number>()
  const seenListing = new Map<string, number>()

  for (const snapshot of snapshots) {
    const name = parsed.get(snapshot.id) ?? emptyParsed('')
    if (name.exactKey) link(seenExact, `${snapshot.item_id}\u0000${name.exactKey}`, snapshot.id, union)
    if (name.identityKey && name.identityTokens >= 2) {
      link(seenIdentity, `${snapshot.item_id}\u0000${name.identityKey}`, snapshot.id, union)
    }
    const listing = listingKey(snapshot.product_url)
    if (listing && name.exactKey) link(seenListing, `${snapshot.item_id}\u0000${listing}`, snapshot.id, union)
  }

  const components = new Map<number, PriceSnapshot[]>()
  for (const snapshot of snapshots) {
    const root = find(snapshot.id)
    const list = components.get(root) ?? []
    list.push(snapshot)
    components.set(root, list)
  }

  const assigned = new Map<number, ProductAssignment>()
  for (const members of components.values()) {
    const itemId = members[0]?.item_id ?? ''
    const names = members.map((snapshot) => parsed.get(snapshot.id) ?? emptyParsed(''))
    const identityKeys = [...new Set(names.map((name) => name.identityKey).filter((key): key is string => Boolean(key)))]
    const canonical = chooseCanonical(identityKeys)
    const unnamed = !canonical && names.every((name) => !name.exactKey)
    const productKey = unnamed ? `${itemId}\u0000` : `${itemId}\u0000${canonical ?? names.find((name) => name.exactKey)?.exactKey ?? 'named'}`
    const baseLabel = labelFor(canonical, names)
    const sharedSizes = sharedSizeNorms(names)
    const displayName = withSharedSizes(baseLabel, sharedSizes, names)
    const variantKeysByStore = new Map<string, Set<string>>()
    for (const snapshot of members) {
      const storeKey = snapshot.store_id ?? ''
      const keys = variantKeysByStore.get(storeKey) ?? new Set<string>()
      keys.add(variantKey(snapshot, parsed.get(snapshot.id) ?? emptyParsed('')))
      variantKeysByStore.set(storeKey, keys)
    }
    for (const snapshot of members) {
      const name = parsed.get(snapshot.id) ?? emptyParsed('')
      const optionTokens = name.tokens.filter((token) => token.role !== 'identity' && token.role !== 'drop' && !(token.role === 'size' && sharedSizes.has(token.norm)))
      const storeKeys = variantKeysByStore.get(snapshot.store_id ?? '')
      assigned.set(snapshot.id, {
        productKey,
        displayName,
        optionLabel: optionTokens.length > 0 ? optionTokens.map((token) => token.raw).join(' ') : null,
        optionKind: kindOf(optionTokens.map((token) => token.role as VariantKind)),
        unnamed,
        multiVariant: (storeKeys?.size ?? 0) > 1,
      })
    }
  }
  return assigned
}

export function variantKey(snapshot: PriceSnapshot, name: ParsedName = parseOfferName(snapshot.product_name)): string {
  const listing = listingKey(snapshot.product_url)
  if (listing) return `listing:${listing}`
  const weak = weakUrl(snapshot.product_url)
  if (weak) return `url:${weak}`
  if (name.variantLabel) return `label:${name.variantLabel.toLowerCase()}`
  return 'plain'
}

function chooseCanonical(keys: string[]): string | null {
  if (keys.length === 0) return null
  const subsets = keys.filter((key) => keys.every((other) => isTokenSubset(key, other)))
  const pool = subsets.length > 0 ? subsets : keys
  return [...pool].sort((left, right) => left.split(' ').length - right.split(' ').length || left.localeCompare(right))[0] ?? null
}

function isTokenSubset(left: string, right: string): boolean {
  const other = new Set(right.split(' '))
  return left.split(' ').every((token) => other.has(token))
}

function labelFor(canonical: string | null, names: ParsedName[]): string | null {
  const matches = names.filter((name) => name.identityKey === canonical && name.identityLabel)
  const labels = matches.map((name) => name.identityLabel).filter((label): label is string => Boolean(label))
  if (labels.length === 0) return null
  return [...labels].sort((left, right) => left.length - right.length || left.localeCompare(right))[0] ?? null
}

function sharedSizeNorms(names: ParsedName[]): Set<string> {
  const present = names.filter((name) => name.exactKey)
  if (present.length === 0) return new Set()
  const [first, ...rest] = present
  const shared = new Set(first?.sizeNorms ?? [])
  for (const name of rest) {
    const own = new Set(name.sizeNorms)
    for (const size of shared) if (!own.has(size)) shared.delete(size)
  }
  return shared
}

function withSharedSizes(baseLabel: string | null, sharedSizes: Set<string>, names: ParsedName[]): string | null {
  if (!baseLabel) return null
  const codes = [...sharedSizes].filter((size) => sizeCodes.has(size))
  if (codes.length === 0) return baseLabel
  const raw = new Map<string, string>()
  for (const name of names) {
    for (const token of name.tokens) {
      if (token.role === 'size' && sharedSizes.has(token.norm) && !raw.has(token.norm)) raw.set(token.norm, token.raw)
    }
  }
  const suffix = codes.map((size) => raw.get(size) ?? size.toUpperCase()).join(' ')
  return `${baseLabel} ${suffix}`.trim()
}

function kindOf(kinds: VariantKind[]): VariantKind | null {
  const present = new Set(kinds)
  if (present.size === 0) return null
  if ([...present].every((kind) => kind === 'colour' || kind === 'edition')) return 'colour'
  if (present.has('colour')) return 'colour'
  if (present.has('edition')) return 'edition'
  if (present.has('finish')) return 'finish'
  if (present.has('size')) return 'size'
  return null
}

function link(index: Map<string, number>, key: string, id: number, union: (left: number, right: number) => void) {
  const previous = index.get(key)
  if (previous == null) index.set(key, id)
  else union(previous, id)
}

function createUnion(ids: number[]) {
  const parent = new Map<number, number>()
  for (const id of ids) parent.set(id, id)
  function find(id: number): number {
    const current = parent.get(id) ?? id
    if (current === id) return id
    const root = find(current)
    parent.set(id, root)
    return root
  }
  function union(left: number, right: number) {
    const leftRoot = find(left)
    const rightRoot = find(right)
    if (leftRoot !== rightRoot) parent.set(rightRoot, leftRoot)
  }
  return { find, union }
}

function emptyParsed(exact: string): ParsedName {
  return { exactKey: exact, identityKey: null, identityLabel: null, variantLabel: null, variantKind: null, identityTokens: 0, sizeNorms: [], tokens: [] }
}

function exactKey(value: string): string {
  return value.toLowerCase().replace(/&/g, ' ').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()
}

function tokenize(value: string): Array<{ raw: string; norm: string; paren: boolean }> {
  const tokens: Array<{ raw: string; norm: string; paren: boolean }> = []
  let depth = 0
  let buffer = ''
  let bufferParen = false
  const flush = () => {
    if (!buffer) return
    tokens.push({ raw: buffer, norm: buffer.toLowerCase(), paren: bufferParen })
    buffer = ''
  }
  for (const char of value.replace(/&/g, ' ')) {
    if (char === '(' || char === '[' || char === '{') {
      flush()
      depth += 1
      continue
    }
    if (char === ')' || char === ']' || char === '}') {
      flush()
      depth = Math.max(0, depth - 1)
      continue
    }
    if (/[A-Za-z0-9]/.test(char) || (char === '-' && /[A-Za-z0-9]$/.test(buffer))) {
      if (!buffer) bufferParen = depth > 0
      buffer += char
      continue
    }
    flush()
  }
  flush()
  return tokens
}

function classify(tokens: Array<{ raw: string; norm: string; paren: boolean }>): ClassifiedToken[] {
  const classified: ClassifiedToken[] = tokens.map((token) => ({ raw: token.raw, norm: token.norm, role: 'identity' }))
  for (let index = 0; index < tokens.length; index += 1) {
    if (!editionMarkers.has(tokens[index]?.norm ?? '')) continue
    const current = classified[index]
    if (current) current.role = 'drop'
    const previous = classified[index - 1]
    const previousNorm = tokens[index - 1]?.norm ?? ''
    if (!previous || previous.role !== 'identity') continue
    if (/\d/.test(previousNorm)) continue
    previous.role = colours.has(previousNorm) ? 'colour' : 'edition'
  }
  tokens.forEach((token, index) => {
    const current = classified[index]
    if (!current || current.role !== 'identity') return
    if (token.paren && isSku(token.norm)) {
      current.role = 'drop'
      return
    }
    if (colours.has(token.norm)) current.role = 'colour'
    else if (sizes.has(token.norm)) current.role = 'size'
    else if (finishes.has(token.norm)) current.role = 'finish'
    else if (fluff.has(token.norm) || dropWords.has(token.norm) || editionMarkers.has(token.norm)) current.role = 'drop'
  })
  return classified
}

function isSku(norm: string): boolean {
  if (!/\d/.test(norm)) return false
  if (/^(19|20)\d{2}$/.test(norm)) return false
  if (sizes.has(norm)) return false
  return true
}

function readUrl(url: string | null | undefined): URL | null {
  if (!url) return null
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    return parsed
  } catch {
    return null
  }
}

function host(parsed: URL): string {
  return parsed.hostname.toLowerCase().replace(/^www\./, '')
}

function isWeakPath(path: string): boolean {
  const value = path.toLowerCase()
  return value === '/' || value === '' || value.includes('/category/') || value.includes('/search')
}

function weakUrl(url: string | null | undefined): string | null {
  const parsed = readUrl(url)
  if (!parsed || listingKey(url) || isWeakPath(parsed.pathname)) return null
  const path = parsed.pathname.replace(/\/+$/, '')
  if (!path) return null
  return `${host(parsed)}${path.toLowerCase()}`
}
