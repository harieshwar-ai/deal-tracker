import * as Tabs from '@radix-ui/react-tabs'
import { motion, useReducedMotion } from 'motion/react'

const ease = [0.2, 0, 0, 1] as const

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  const reduce = useReducedMotion()
  return (
    <Tabs.Root value={value} onValueChange={(next) => onChange(next as T)}>
      <Tabs.List
        aria-label={label}
        className="inline-flex flex-wrap gap-1 rounded-lg border border-line bg-paper p-1 shadow-sm"
      >
        {options.map((option) => {
          const selected = option.value === value
          return (
            <Tabs.Trigger
              key={option.value}
              value={option.value}
              className="relative min-h-11 rounded-md px-3 py-1.5 text-sm text-muted transition-colors duration-200 data-[state=active]:text-ink md:min-h-0"
            >
              {selected ? (
                <motion.span
                  layoutId={`segment-${label}`}
                  className="absolute inset-0 rounded-md bg-paper-2 shadow-sm"
                  transition={reduce ? { duration: 0 } : { type: 'tween', duration: 0.2, ease }}
                />
              ) : null}
              <span className="relative">{option.label}</span>
            </Tabs.Trigger>
          )
        })}
      </Tabs.List>
    </Tabs.Root>
  )
}
