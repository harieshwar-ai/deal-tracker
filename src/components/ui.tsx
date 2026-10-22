import * as Dialog from '@radix-ui/react-dialog'
import * as Switch from '@radix-ui/react-switch'
import { X } from 'lucide-react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '../lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

const variantClass: Record<Variant, string> = {
  primary: 'bg-pine text-white hover:bg-pine/90',
  secondary: 'border border-line bg-paper-2 text-ink hover:bg-paper',
  ghost: 'text-ink hover:bg-paper',
  danger: 'bg-clay text-white hover:bg-clay/90',
}

const sizeClass: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2',
}

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', className?: string): string {
  return cn(
    'inline-flex items-center justify-center gap-2 rounded-full font-medium transition disabled:cursor-not-allowed disabled:opacity-50',
    variantClass[variant],
    sizeClass[size],
    className,
  )
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return <button type={type} className={buttonClass(variant, size, className)} {...props} />
}

export const controlClass =
  'w-full rounded-2xl border border-line bg-white px-3 py-2 text-ink outline-none placeholder:text-muted/80 focus:border-pine'

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string
  hint?: string
  error?: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <div className="mt-1">{children}</div>
      {error ? <span className="mt-1 block text-sm text-clay">{error}</span> : null}
      {!error && hint ? <span className="mt-1 block text-sm text-muted">{hint}</span> : null}
    </label>
  )
}

export function Badge({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', className)}>
      {children}
    </span>
  )
}

export function Modal({
  open,
  title,
  description,
  onClose,
  children,
}: {
  open: boolean
  title: string
  description?: string
  onClose: () => void
  children: ReactNode
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-bark/50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 max-h-[min(92vh,46rem)] w-[min(calc(100%-1.5rem),40rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl border border-line bg-paper-2 p-5 shadow-xl focus:outline-none md:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="font-display text-3xl leading-none">{title}</Dialog.Title>
              {description ? <Dialog.Description className="mt-2 text-sm text-muted">{description}</Dialog.Description> : null}
            </div>
            <Dialog.Close className="rounded-full p-2 text-muted hover:bg-paper" aria-label="Close">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>
          <div className="mt-5">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  pending,
  onConfirm,
  onClose,
}: {
  open: boolean
  title: string
  body: string
  confirmLabel: string
  pending?: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <Modal open={open} title={title} onClose={onClose}>
      <p className="text-sm leading-6 text-muted">{body}</p>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button variant="danger" onClick={onConfirm} disabled={pending}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}

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
    <label className="flex items-center justify-between gap-3 rounded-2xl border border-line px-3 py-2">
      <span className="text-sm font-medium">{label}</span>
      <Switch.Root
        checked={checked}
        onCheckedChange={onChange}
        aria-label={label}
        className="relative h-6 w-11 shrink-0 rounded-full bg-line data-[state=checked]:bg-pine"
      >
        <Switch.Thumb className="block h-5 w-5 translate-x-0.5 rounded-full bg-white transition-transform data-[state=checked]:translate-x-5" />
      </Switch.Root>
    </label>
  )
}

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
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1 rounded-full border border-line bg-paper p-1">
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn('rounded-full px-3 py-1.5 text-sm', selected ? 'bg-bark text-paper-2' : 'text-muted hover:text-ink')}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="rounded-3xl border border-dashed border-line bg-paper-2 px-6 py-12 text-center">
      <h2 className="font-display text-3xl">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">{body}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}

export function LoadingBlock({ label = 'Loading your prices…' }: { label?: string }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-live="polite">
      <p className="text-sm text-muted">{label}</p>
      <div className="h-28 animate-pulse rounded-3xl bg-line/80" />
      <div className="h-28 animate-pulse rounded-3xl bg-line/60" />
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-3xl border border-clay/30 bg-clay-soft px-6 py-8">
      <h2 className="font-display text-3xl">Could not load Harbour</h2>
      <p className="mt-2 text-sm leading-6">{message}</p>
      <Button className="mt-4" onClick={onRetry}>
        Try again
      </Button>
    </div>
  )
}
