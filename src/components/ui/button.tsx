import { Slot } from '@radix-ui/react-slot'
import { cva } from 'class-variance-authority'
import type { ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium shadow-sm transition-[background-color,color,border-color,box-shadow,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine/40 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]',
  {
    variants: {
      variant: {
        primary: 'bg-pine text-on-accent hover:bg-pine/90',
        secondary: 'border border-line bg-paper-2 text-ink hover:bg-paper',
        ghost: 'text-ink shadow-none hover:bg-paper',
        danger: 'bg-clay text-on-accent hover:bg-clay/90',
      },
      size: {
        sm: 'h-9 px-3 text-sm',
        md: 'h-10 px-4 text-sm',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
)

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', className?: string): string {
  return cn(buttonVariants({ variant, size }), className)
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  type = 'button',
  asChild = false,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; asChild?: boolean }) {
  if (asChild) {
    return <Slot className={buttonClass(variant, size, className)} {...props} />
  }
  return <button type={type} className={buttonClass(variant, size, className)} {...props} />
}
