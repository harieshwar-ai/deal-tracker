import { describe, expect, it } from 'vitest'
import { seasonCards } from './seasons'

describe('season cards', () => {
  it('counts down to the next Black Friday and Boxing Day without inventing Prime Day', () => {
    const cards = seasonCards(new Date('2026-10-23T16:00:00.000Z'))
    const friday = cards.find((card) => card.id === 'black-friday')
    const boxing = cards.find((card) => card.id === 'boxing-day')
    const prime = cards.find((card) => card.id === 'prime-day')
    expect(friday?.days).toBe(35)
    expect(friday?.when).toMatch(/2026/)
    expect(boxing?.days).toBe(64)
    expect(prime?.days).toBeNull()
    expect(prime?.detail.toLowerCase()).toContain('not a price saved')
    expect(friday?.detail.toLowerCase()).not.toContain('snapshot')
  })

  it('rolls Boxing Day to the next year once it has passed', () => {
    const boxing = seasonCards(new Date('2026-12-27T16:00:00.000Z')).find((card) => card.id === 'boxing-day')
    expect(boxing?.when).toMatch(/2027/)
    expect(boxing?.days).toBeGreaterThan(300)
  })
})
