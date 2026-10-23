// The app tsconfig does not include Node types. This read only runs in Vitest.
// @ts-expect-error TS2591 — node:fs is available when Vitest runs the test.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { contrastRatio } from './contrast'
import { accents, semantic, surfaces } from './tokens'

const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8')

describe('palette contrast', () => {
  it('keeps the published dark page colour the navigation test checks', () => {
    expect(surfaces.dark.paper).toBe('#0d1014')
    expect(css).toContain('--color-paper: #0d1014;')
  })

  it('meets WCAG AA for text on light and dark surfaces', () => {
    const pairs: Array<[string, string, string]> = [
      ['ink on paper', surfaces.light.ink, surfaces.light.paper],
      ['muted on paper', semantic.light.muted, surfaces.light.paper],
      ['muted on white', semantic.light.muted, surfaces.light.paper2],
      ['buy on white', semantic.light.buy, '#ffffff'],
      ['white on buy', semantic.light.onBuy, semantic.light.buy],
      ['buy on buy soft', semantic.light.buy, semantic.light.buySoft],
      ['wait on wait soft', semantic.light.wait, semantic.light.waitSoft],
      ['white on wait', semantic.light.onWait, semantic.light.wait],
      ['skip on skip soft', semantic.light.skip, semantic.light.skipSoft],
      ['white on skip', semantic.light.onSkip, semantic.light.skip],
      ['rise on white', semantic.light.rise, '#ffffff'],
      ['good on good soft', semantic.light.good, semantic.light.goodSoft],
      ['white on harbour', accents.harbour.light.on, accents.harbour.light.pine],
      ['harbour on white', accents.harbour.light.pine, '#ffffff'],
      ['white on tide', accents.tide.light.on, accents.tide.light.pine],
      ['tide on white', accents.tide.light.pine, '#ffffff'],
      ['white on copper', accents.copper.light.on, accents.copper.light.pine],
      ['copper on white', accents.copper.light.pine, '#ffffff'],
      ['dark ink on paper', surfaces.dark.ink, surfaces.dark.paper],
      ['dark muted on paper', semantic.dark.muted, surfaces.dark.paper],
      ['dark muted on surface', semantic.dark.muted, surfaces.dark.paper2],
      ['dark buy on paper', semantic.dark.buy, surfaces.dark.paper],
      ['dark on buy', semantic.dark.onBuy, semantic.dark.buy],
      ['dark buy on soft', semantic.dark.buy, semantic.dark.buySoft],
      ['dark wait on paper', semantic.dark.wait, surfaces.dark.paper],
      ['dark on wait', semantic.dark.onWait, semantic.dark.wait],
      ['dark wait on soft', semantic.dark.wait, semantic.dark.waitSoft],
      ['dark skip on paper', semantic.dark.skip, surfaces.dark.paper],
      ['dark skip on soft', semantic.dark.skip, semantic.dark.skipSoft],
      ['dark on skip', semantic.dark.onSkip, semantic.dark.skip],
      ['dark rise on paper', semantic.dark.rise, surfaces.dark.paper],
      ['dark on rise', semantic.dark.onSkip, semantic.dark.rise],
      ['dark good on paper', semantic.dark.good, surfaces.dark.paper],
      ['dark harbour on paper', accents.harbour.dark.pine, surfaces.dark.paper],
      ['dark on harbour', accents.harbour.dark.on, accents.harbour.dark.pine],
      ['dark tide on paper', accents.tide.dark.pine, surfaces.dark.paper],
      ['dark on tide', accents.tide.dark.on, accents.tide.dark.pine],
      ['dark copper on paper', accents.copper.dark.pine, surfaces.dark.paper],
      ['dark on copper', accents.copper.dark.on, accents.copper.dark.pine],
      ['dark on-accent on gold count', accents.harbour.dark.on, semantic.dark.wait],
      ['copper on-accent on gold count', accents.copper.dark.on, semantic.dark.wait],
      ['tide on-accent on rise button', accents.tide.dark.on, semantic.dark.rise],
    ]
    for (const [name, foreground, background] of pairs) {
      expect(contrastRatio(foreground, background), name).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('writes the same accent and verdict colours into the stylesheet', () => {
    expect(css).toContain(`--color-pine: ${accents.harbour.light.pine};`)
    expect(css).toContain(`--color-buy: ${semantic.light.buy};`)
    expect(css).toContain(`--color-wait: ${semantic.light.wait};`)
    expect(css).toContain(`--color-skip: ${semantic.light.skip};`)
    expect(css).toContain(`--color-drop: ${semantic.light.drop};`)
    expect(css).toContain(`--color-rise: ${semantic.light.rise};`)
    expect(css).toContain(`--color-pine: ${accents.tide.light.pine};`)
    expect(css).toContain(`--color-pine: ${accents.copper.dark.pine};`)
    expect(css).toContain(`--color-buy: ${semantic.dark.buy};`)
    expect(css).toContain(`--color-muted: ${semantic.dark.muted};`)
  })
})
