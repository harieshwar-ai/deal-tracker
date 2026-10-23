export type Priority = 'low' | 'normal' | 'high'
export type Verdict = 'must_buy' | 'good' | 'ok' | 'skip'
export type DealStatus = 'open' | 'bought' | 'dismissed' | 'expired'
export type VerdictGroup = Verdict | 'unrated'
export type DatePreset = '30d' | '90d' | '365d' | 'all'
export type ActivityFilter = 'active' | 'paused' | 'all'
export type WatchSort = 'target_gap' | 'price_asc' | 'priority' | 'name' | 'updated'

export interface Store {
  id: string
  name: string
  base_url: string | null
  country: string | null
  membership: string | null
  notes: string | null
  enabled: boolean
  created_at: string
  updated_at: string
}

export interface ItemSpec {
  name: string
  value: string
}

export interface ItemRequirement {
  label: string
}

export interface Item {
  id: string
  name: string
  public_summary: string | null
  description: string | null
  category: string | null
  keywords: string[]
  target_price: number | null
  max_price: number | null
  priority: Priority
  condition: string | null
  notes: string | null
  image_url: string | null
  specs: ItemSpec[]
  requirements: ItemRequirement[]
  active: boolean
  created_at: string
  updated_at: string
}

export interface PriceSnapshot {
  id: number
  item_id: string
  store_id: string | null
  product_title: string | null
  product_url: string | null
  price: number
  regular_price: number | null
  currency: string
  in_stock: boolean | null
  member_only: boolean | null
  captured_at: string
}

export interface Deal {
  id: string
  item_id: string
  store_id: string | null
  snapshot_id: number | null
  title: string
  url: string | null
  price: number
  regular_price: number | null
  discount_pct: number | null
  score: number | null
  verdict: Verdict | null
  reason: string | null
  notified_at: string | null
  expires_at: string | null
  status: DealStatus
  found_at: string
}

export interface Dataset {
  items: Item[]
  stores: Store[]
  snapshots: PriceSnapshot[]
  deals: Deal[]
}

export interface ItemWrite {
  name: string
  public_summary: string | null
  description: string | null
  category: string | null
  keywords: string[]
  target_price: number | null
  max_price: number | null
  priority: Priority
  condition: string
  notes: string | null
  image_url: string | null
  specs: ItemSpec[]
  requirements: ItemRequirement[]
  active: boolean
}

export interface StoreWrite {
  name: string
  base_url: string | null
  country: string
  membership: string | null
  notes: string | null
  enabled: boolean
}

export interface ItemDraft {
  name: string
  publicSummary: string
  description: string
  category: string
  keywords: string
  targetPrice: string
  maxPrice: string
  priority: Priority
  condition: string
  notes: string
  imageUrl: string
  specs: string
  requirements: string
  active: boolean
}

export interface StoreDraft {
  name: string
  baseUrl: string
  country: string
  membership: string
  notes: string
  enabled: boolean
}

export interface FieldError {
  field: string
  message: string
}

export type ParseResult<T> = { ok: true; value: T } | { ok: false; errors: FieldError[] }
