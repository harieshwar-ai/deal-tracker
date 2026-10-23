import { Monitor, Moon, Sun } from 'lucide-react'
import { themeToggleLabel, useTheme } from '../theme/theme'

export function ThemeToggle() {
  const theme = useTheme()
  const ThemeIcon = theme.choice === 'dark' ? Moon : theme.choice === 'light' ? Sun : Monitor
  return (
    <button
      type="button"
      className="rounded-full p-2 text-muted hover:bg-paper"
      onClick={theme.cycle}
      aria-label={themeToggleLabel(theme.choice)}
    >
      <ThemeIcon className="h-4 w-4" />
    </button>
  )
}
