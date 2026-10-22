import type { ActivityFilter, DatePreset, DealStatus, Priority, WatchSort } from './types'

export type StatusFilter = DealStatus | 'all'

export function parseSort(value: string | null): WatchSort {
  switch (value) {
    case 'target_gap':
    case 'price_asc':
    case 'priority':
    case 'name':
    case 'updated':
      return value
    default:
      return 'target_gap'
  }
}

export function parseActivity(value: string | null): ActivityFilter {
  switch (value) {
    case 'active':
    case 'paused':
    case 'all':
      return value
    default:
      return 'active'
  }
}

export function parsePriorityFilter(value: string | null): Priority | 'all' {
  switch (value) {
    case 'low':
    case 'normal':
    case 'high':
    case 'all':
      return value
    default:
      return 'all'
  }
}

export function parseStatusFilter(value: string | null): StatusFilter {
  switch (value) {
    case 'open':
    case 'bought':
    case 'dismissed':
    case 'expired':
    case 'all':
      return value
    default:
      return 'open'
  }
}

export function parsePresetParam(value: string | null): DatePreset {
  switch (value) {
    case '30d':
    case '90d':
    case '365d':
    case 'all':
      return value
    default:
      return '90d'
  }
}
