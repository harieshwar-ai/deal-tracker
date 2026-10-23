import { cva } from 'class-variance-authority'
import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

const badgeVariants = cva('inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium')

export function Badge({ className, children }: { className?: string; children: ReactNode }) {
  return <span className={cn(badgeVariants(), className)}>{children}</span>
}
