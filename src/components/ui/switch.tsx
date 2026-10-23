import * as Switch from '@radix-ui/react-switch'

export function Toggle({
  checked,
  label,
  onChange,
}: {
  checked: boolean
  label: string
  onChange: (next: boolean) => void
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-lg border border-line bg-paper-2 px-3 py-2 shadow-sm">
      <span className="text-sm font-medium">{label}</span>
      <Switch.Root
        checked={checked}
        onCheckedChange={onChange}
        aria-label={label}
        className="relative h-6 w-11 shrink-0 rounded-full bg-line transition-colors duration-200 data-[state=checked]:bg-pine"
      >
        <Switch.Thumb className="block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow-sm transition-transform duration-200 data-[state=checked]:translate-x-5" />
      </Switch.Root>
    </label>
  )
}
