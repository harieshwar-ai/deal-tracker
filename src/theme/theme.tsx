import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

export type ThemeChoice = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

const storageKey = 'harbour-theme'
const cycle: ThemeChoice[] = ['system', 'light', 'dark']

function readChoice(): ThemeChoice {
  try {
    const stored = localStorage.getItem(storageKey)
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  } catch {
    // Private browsing can block storage. Fall through to the system setting.
  }
  return 'system'
}

function prefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function nextTheme(choice: ThemeChoice): ThemeChoice {
  const index = cycle.indexOf(choice)
  return cycle[(index + 1) % cycle.length] ?? 'system'
}

export function resolveTheme(choice: ThemeChoice, systemIsDark: boolean): ResolvedTheme {
  switch (choice) {
    case 'system':
      return systemIsDark ? 'dark' : 'light'
    case 'light':
    case 'dark':
      return choice
    default: {
      const neverChoice: never = choice
      return neverChoice
    }
  }
}

export function themeToggleLabel(choice: ThemeChoice): string {
  switch (choice) {
    case 'system':
      return 'Colour theme follows the system. Switch to light.'
    case 'light':
      return 'Colour theme is light. Switch to dark.'
    case 'dark':
      return 'Colour theme is dark. Switch to the system setting.'
    default: {
      const neverChoice: never = choice
      return neverChoice
    }
  }
}

interface ThemeValue {
  choice: ThemeChoice
  resolved: ResolvedTheme
  cycle: () => void
}

const ThemeContext = createContext<ThemeValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [choice, setChoice] = useState<ThemeChoice>(readChoice)
  const [resolved, setResolved] = useState<ResolvedTheme>(() => resolveTheme(readChoice(), prefersDark()))

  useEffect(() => {
    const next = resolveTheme(choice, prefersDark())
    setResolved(next)
    document.documentElement.dataset.theme = next
    try {
      localStorage.setItem(storageKey, choice)
    } catch {
      // Ignore storage failures. The in-memory choice still applies.
    }
  }, [choice])

  useEffect(() => {
    if (choice !== 'system') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const next = resolveTheme('system', media.matches)
      setResolved(next)
      document.documentElement.dataset.theme = next
    }
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [choice])

  const value = useMemo<ThemeValue>(() => ({
    choice,
    resolved,
    cycle: () => setChoice((current) => nextTheme(current)),
  }), [choice, resolved])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeValue {
  const value = useContext(ThemeContext)
  if (!value) throw new Error('useTheme must be used inside ThemeProvider.')
  return value
}
