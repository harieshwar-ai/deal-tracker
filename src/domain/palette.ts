export const palette = {
  pine: '#0e6b4f',
  gold: '#b86114',
  sea: '#1e4d7b',
  berry: '#7a3e5a',
  moss: '#3d6b2f',
  teal: '#0f6f78',
  clay: '#8f2d2d',
  ink: '#1c1915',
  muted: '#8a847b',
  grid: '#e4dcd0',
  paper: '#fffdf8',
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
