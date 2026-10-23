import { describe, expect, it } from 'vitest'
import { nextTheme, resolveTheme, themeToggleLabel } from './theme'

describe('theme', () => {
  it('cycles system, light, then dark', () => {
    expect(nextTheme('system')).toBe('light')
    expect(nextTheme('light')).toBe('dark')
    expect(nextTheme('dark')).toBe('system')
  })

  it('follows the system preference only for the system choice', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })

  it('names the current choice in the toggle label', () => {
    expect(themeToggleLabel('system')).toContain('system')
    expect(themeToggleLabel('light')).toContain('light')
    expect(themeToggleLabel('dark')).toContain('dark')
  })
})