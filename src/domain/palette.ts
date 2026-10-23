export const palette = {
  pine: '#0c6b52',
  gold: '#8a5a12',
  sea: '#1d4e89',
  berry: '#7a3e5a',
  moss: '#3d6b2f',
  teal: '#0f6f78',
  clay: '#a33b3b',
  ink: '#12161c',
  muted: '#5e6a78',
  grid: '#e4e8ee',
  paper: '#ffffff',
} as const

export const storePalette = [
  palette.pine,
  palette.gold,
  palette.sea,
  palette.berry,
  palette.moss,
  palette.teal,
  '#8a4b08',
  '#3e4c9a',
] as const

export function seriesColor(index: number): string {
  const safe = index >= 0 ? index : storePalette.length - 1
  return storePalette[safe % storePalette.length] ?? palette.muted
}
