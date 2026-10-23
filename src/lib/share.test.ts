import { describe, expect, it } from 'vitest'
import { escapeHtml, itemShare } from './share'

describe('item share meta', () => {
  it('uses the public summary and escapes markup', () => {
    const meta = itemShare({
      id: 'abc',
      name: 'Chair <tall>',
      public_summary: 'A chair & a quote "frog".',
      category: 'Furniture',
    })
    expect(meta.title).toBe('Chair <tall> · Harbour')
    expect(meta.description).toBe('A chair & a quote "frog".')
    expect(meta.url).toBe('https://harieshwar-ai.github.io/deal-tracker/items/abc/')
    expect(escapeHtml(meta.title)).toBe('Chair &lt;tall&gt; · Harbour')
    expect(escapeHtml(meta.description)).not.toContain('"')
  })

  it('does not fall back to private fields when the summary is missing', () => {
    const meta = itemShare({ id: 'abc', name: 'Chair', public_summary: null, category: 'Furniture' })
    expect(meta.description).toBe('Chair. Furniture.')
    expect(meta.description.toLowerCase()).not.toContain('target')
  })
})
