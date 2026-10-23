import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export function Menu({
  label,
  trigger,
  children,
}: {
  label: string
  trigger: ReactNode
  children: ReactNode
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild aria-label={label}>
        {trigger}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-[70] min-w-44 rounded-lg border border-line bg-paper-2 p-1 text-sm text-ink shadow-lg"
        >
          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

export function MenuRadioGroup({
  value,
  onValueChange,
  options,
}: {
  value: string
  onValueChange: (value: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <DropdownMenu.RadioGroup value={value} onValueChange={onValueChange}>
      {options.map((option) => (
        <DropdownMenu.RadioItem
          key={option.value}
          value={option.value}
          className={cn(
            'cursor-pointer rounded-md px-3 py-2 outline-none data-[highlighted]:bg-paper data-[state=checked]:font-medium',
          )}
        >
          {option.label}
        </DropdownMenu.RadioItem>
      ))}
    </DropdownMenu.RadioGroup>
  )
}
