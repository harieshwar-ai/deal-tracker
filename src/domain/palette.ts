import { lightStorePalette } from '../theme/tokens'

export const palette = {
  pine: '#0b5e4a',
  gold: '#8a4f0b',
  sea: '#1a4a80',
  berry: '#7a3a48',
  moss: '#3d6b2f',
  teal: '#0f6f78',
  clay: '#9b2c2c',
  ink: '#12161c',
  muted: '#4a5563',
  grid: '#d5dce5',
  paper: '#ffffff',
} as const

export const storePalette = lightStorePalette

export function seriesColor(index: number): string {
  const safe = index >= 0 ? index : storePalette.length - 1
  return storePalette[safe % storePalette.length] ?? palette.muted
}
