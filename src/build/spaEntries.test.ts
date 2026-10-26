// @ts-expect-error TS2591 — node:fs is available when Vitest runs the test.
import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { SPA_ENTRY_ROUTES } from './spaEntries.ts'

describe('spa entry routes', () => {
  it('lists confirm and unsubscribe', () => {
    expect(SPA_ENTRY_ROUTES).toEqual(['confirm', 'unsubscribe'])
  })

  it('emits index.html copies under dist when a production build exists', () => {
    if (!existsSync('dist/index.html')) return
    for (const route of SPA_ENTRY_ROUTES) {
      const path = `dist/${route}/index.html`
      expect(existsSync(path), path).toBe(true)
      expect(readFileSync(path, 'utf8')).toContain('harbour-meta:start')
    }
    expect(existsSync('dist/404.html')).toBe(true)
  })
})
