import { describe, expect, it } from 'vitest'
import { normalizeCountryCode } from './country'

describe('waitlist validation', () => {
  it('accepts ISO country codes only', () => {
    expect(normalizeCountryCode('us')).toBe('US')
    expect(normalizeCountryCode('USA')).toBeNull()
    expect(normalizeCountryCode('')).toBeNull()
  })
})
