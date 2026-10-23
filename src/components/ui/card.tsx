import type { HTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

export const cardClass = 'rounded-xl border border-line bg-paper-2 shadow-sm'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn(cardClass, className)} {...props} />
}
