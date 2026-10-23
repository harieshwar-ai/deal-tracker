import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

export const controlClass =
  'w-full rounded-lg border border-line bg-paper-2 px-3 py-2 text-base text-ink shadow-sm outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-muted/80 focus:border-pine focus:ring-2 focus:ring-pine/20 md:text-sm'

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(controlClass, className)} {...props} />
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(controlClass, className)} {...props} />
}

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
      <div className="mt-1.5">{children}</div>
      {error ? <span className="mt-1 block text-sm text-clay">{error}</span> : null}
      {!error && hint ? <span className="mt-1 block text-sm text-muted">{hint}</span> : null}
    </label>
  )
}
