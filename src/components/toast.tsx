import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { cn } from '../lib/cn'

interface ToastItem {
  id: number
  tone: 'ok' | 'error'
  text: string
}

const ToastContext = createContext<((tone: 'ok' | 'error', text: string) => void) | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const push = useCallback((tone: 'ok' | 'error', text: string) => {
    const id = Date.now() + Math.random()
    setToasts((current) => [...current, { id, tone, text }])
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id))
    }, 4200)
  }, [])
  const value = useMemo(() => push, [push])
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 bottom-20 z-50 flex w-[min(24rem,calc(100%-2rem))] flex-col gap-2 md:bottom-6" aria-live="polite">
        {toasts.map((toast) => (
          <p
            key={toast.id}
            className={cn(
              'pointer-events-auto rounded-2xl border px-4 py-3 text-sm shadow-lg',
              toast.tone === 'ok' ? 'border-pine/20 bg-pine-soft text-ink' : 'border-clay/30 bg-clay-soft text-ink',
            )}
          >
            {toast.text}
          </p>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): (tone: 'ok' | 'error', text: string) => void {
  const push = useContext(ToastContext)
  if (!push) throw new Error('useToast must be used inside ToastProvider.')
  return push
}
