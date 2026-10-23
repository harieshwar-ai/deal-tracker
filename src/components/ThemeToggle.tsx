import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme } from '../theme/theme'
import type { ThemeChoice } from '../theme/theme'
import { Menu, MenuRadioGroup } from './ui/dropdown-menu'

const options: { value: ThemeChoice; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

function isThemeChoice(value: string): value is ThemeChoice {
  return value === 'system' || value === 'light' || value === 'dark'
}

export function ThemeToggle() {
  const theme = useTheme()
  const ThemeIcon = theme.choice === 'dark' ? Moon : theme.choice === 'light' ? Sun : Monitor
  return (
    <Menu
      label="Colour theme"
      trigger={
        <button type="button" className="rounded-lg p-2 text-muted hover:bg-paper" aria-label="Colour theme">
          <ThemeIcon className="h-4 w-4" />
        </button>
      }
    >
      <MenuRadioGroup
        value={theme.choice}
        options={options}
        onValueChange={(value) => {
          if (isThemeChoice(value)) theme.setChoice(value)
        }}
      />
    </Menu>
  )
}
