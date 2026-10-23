import { Monitor, Moon, Sun } from 'lucide-react'
import { accentLabel, isAccentChoice } from '../theme/tokens'
import type { AccentChoice } from '../theme/tokens'
import { useTheme } from '../theme/theme'
import type { ThemeChoice } from '../theme/theme'
import { Menu, MenuLabel, MenuRadioGroup, MenuSeparator } from './ui/dropdown-menu'

const options: { value: ThemeChoice; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

const accents: { value: AccentChoice; label: string }[] = [
  { value: 'harbour', label: accentLabel('harbour') },
  { value: 'tide', label: accentLabel('tide') },
  { value: 'copper', label: accentLabel('copper') },
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
      <MenuLabel>Appearance</MenuLabel>
      <MenuRadioGroup
        value={theme.choice}
        options={options}
        onValueChange={(value) => {
          if (isThemeChoice(value)) theme.setChoice(value)
        }}
      />
      <MenuSeparator />
      <MenuLabel>Accent</MenuLabel>
      <MenuRadioGroup
        value={theme.accent}
        options={accents}
        onValueChange={(value) => {
          if (isAccentChoice(value)) theme.setAccent(value)
        }}
      />
      <p className="px-3 py-2 text-xs leading-5 text-muted">Buy, wait, and skip keep their own colours.</p>
    </Menu>
  )
}
