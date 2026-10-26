import * as SelectPrimitive from '@radix-ui/react-select'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '../../lib/cn'

export interface SelectChoice {
  value: string
  label: string
}

export function Select({
  label,
  value,
  onValueChange,
  options = [],
  groups,
  className,
  side = 'bottom',
  sideOffset = 6,
  avoidCollisions = true,
}: {
  label: string
  value: string
  onValueChange: (value: string) => void
  options?: SelectChoice[]
  groups?: { label: string; options: SelectChoice[] }[]
  className?: string
  side?: 'top' | 'bottom'
  sideOffset?: number
  avoidCollisions?: boolean
}) {
  const sections = groups ?? [{ label: '', options }]
  return (
    <SelectPrimitive.Root value={value} onValueChange={onValueChange}>
      <SelectPrimitive.Trigger
        aria-label={label}
        className={cn(
          'inline-flex h-11 min-w-40 items-center justify-between gap-3 rounded-lg border border-line bg-paper-2 px-3 text-left text-sm text-ink shadow-sm transition-[border-color,box-shadow] duration-200 hover:border-pine/40 focus:border-pine md:h-10',
          className,
        )}
      >
        <SelectPrimitive.Value />
        <SelectPrimitive.Icon>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          side={side}
          sideOffset={sideOffset}
          avoidCollisions={avoidCollisions}
          collisionPadding={12}
          className="z-[70] max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg border border-line bg-paper-2 p-1 text-ink shadow-lg"
        >
          <SelectPrimitive.Viewport>
            {sections.map((section) => (
              <SelectPrimitive.Group key={section.label || 'options'}>
                {section.label ? (
                  <SelectPrimitive.Label className="px-3 py-1.5 text-xs font-medium tracking-wide text-muted uppercase">
                    {section.label}
                  </SelectPrimitive.Label>
                ) : null}
                {section.options.map((option) => (
                  <SelectPrimitive.Item
                    key={option.value}
                    value={option.value}
                    className="relative flex cursor-pointer items-center rounded-md py-2 pr-8 pl-3 text-sm outline-none data-[highlighted]:bg-pine-soft data-[highlighted]:outline data-[highlighted]:outline-2 data-[highlighted]:-outline-offset-2 data-[highlighted]:outline-pine data-[state=checked]:font-medium"
                  >
                    <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                    <SelectPrimitive.ItemIndicator className="absolute right-2">
                      <Check className="h-4 w-4 text-pine" />
                    </SelectPrimitive.ItemIndicator>
                  </SelectPrimitive.Item>
                ))}
              </SelectPrimitive.Group>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}
