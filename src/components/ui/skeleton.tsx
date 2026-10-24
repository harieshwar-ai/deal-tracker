import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Button } from './button'

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-line/70', className)} />
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-paper-2 px-5 py-14 text-center shadow-sm sm:px-8">
      <h2 className="font-display text-2xl">{title}</h2>
      <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted">{body}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  )
}

export function LoadingBlock({ label = 'Loading your prices…' }: { label?: string }) {
  return (
    <div className="space-y-4" role="status" aria-busy="true" aria-live="polite">
      <p className="text-sm text-muted">{label}</p>
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-72" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <Skeleton className="h-40" />
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-clay/30 bg-clay-soft px-6 py-8 shadow-sm">
      <h2 className="font-display text-2xl">Could not load Harbour</h2>
      <p className="mt-2 text-sm leading-6">{message}</p>
      <Button className="mt-4" onClick={onRetry}>
        Try again
      </Button>
    </div>
  )
}
