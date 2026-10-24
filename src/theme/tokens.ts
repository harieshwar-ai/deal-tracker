export type AccentChoice = 'harbour' | 'tide' | 'copper'

export interface AccentTokens {
  pine: string
  soft: string
  on: string
}

export const accents: Record<AccentChoice, { light: AccentTokens; dark: AccentTokens }> = {
  harbour: {
    light: { pine: '#0b5e4a', soft: '#e7f4ef', on: '#ffffff' },
    dark: { pine: '#6ee0bc', soft: '#12352c', on: '#062018' },
  },
  tide: {
    light: { pine: '#1a4a80', soft: '#e8f1f8', on: '#ffffff' },
    dark: { pine: '#9ec4ee', soft: '#162433', on: '#0c1824' },
  },
  copper: {
    light: { pine: '#8a4b12', soft: '#f8f1e6', on: '#ffffff' },
    dark: { pine: '#f0c27a', soft: '#2c2416', on: '#24180a' },
  },
}

export interface SemanticTokens {
  buy: string
  buySoft: string
  onBuy: string
  wait: string
  waitSoft: string
  onWait: string
  skip: string
  skipSoft: string
  onSkip: string
  drop: string
  rise: string
  good: string
  goodSoft: string
  onGood: string
  sea: string
  ink: string
  muted: string
  grid: string
  paper: string
  unrated: string
}

export const semantic: Record<'light' | 'dark', SemanticTokens> = {
  light: {
    buy: '#0d6b3c',
    buySoft: '#e7f6ee',
    onBuy: '#ffffff',
    wait: '#8a4f0b',
    waitSoft: '#fbf4e8',
    onWait: '#ffffff',
    skip: '#7a3a48',
    skipSoft: '#f8eef1',
    onSkip: '#ffffff',
    drop: '#0d6b3c',
    rise: '#9b2c2c',
    good: '#0b5e4a',
    goodSoft: '#e7f4ef',
    onGood: '#ffffff',
    sea: '#1a4a80',
    ink: '#12161c',
    muted: '#4a5563',
    grid: '#d5dce5',
    paper: '#ffffff',
    unrated: '#4a5563',
  },
  dark: {
    buy: '#7ddea8',
    buySoft: '#143228',
    onBuy: '#062018',
    wait: '#f0c36a',
    waitSoft: '#2c2414',
    onWait: '#2a1c06',
    skip: '#f3b7c4',
    skipSoft: '#2a1a20',
    onSkip: '#2a1016',
    drop: '#7ddea8',
    rise: '#ffb4ab',
    good: '#6ee0bc',
    goodSoft: '#12352c',
    onGood: '#062018',
    sea: '#9ec4ee',
    ink: '#eef2f6',
    muted: '#d5dee8',
    grid: '#2e3948',
    paper: '#151a21',
    unrated: '#d5dee8',
  },
}

export const surfaces = {
  light: { paper: '#f4f6f8', paper2: '#ffffff', ink: '#12161c' },
  dark: { paper: '#0d1014', paper2: '#151a21', ink: '#eef2f6' },
} as const

export const lightStorePalette = [
  '#0b5e4a',
  '#8a4f0b',
  '#1a4a80',
  '#7a3a48',
  '#3d6b2f',
  '#0f6f78',
  '#8a4b08',
  '#3e4c9a',
] as const

export const darkStorePalette = [
  '#6ee0bc',
  '#f0c36a',
  '#9ec4ee',
  '#f3b7c4',
  '#a8d48f',
  '#7dcec8',
  '#f0c27a',
  '#aeb6e8',
] as const

export function isAccentChoice(value: string): value is AccentChoice {
  return value === 'harbour' || value === 'tide' || value === 'copper'
}

export function accentLabel(choice: AccentChoice): string {
  switch (choice) {
    case 'harbour':
      return 'Harbour'
    case 'tide':
      return 'Tide'
    case 'copper':
      return 'Copper'
    default: {
      const neverChoice: never = choice
      return neverChoice
    }
  }
}
