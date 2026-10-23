import { createContext, useCallback, useContext, useMemo } from 'react'
import type { ReactNode } from 'react'
import { Toaster, toast } from 'sonner'
import { useTheme } from '../theme/theme'

const ToastContext = createContext<((tone: 'ok' | 'error', text: string) => void) | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const theme = useTheme()
  const push = useCallback((tone: 'ok' | 'error', text: string) => {
    if (tone === 'ok') toast.success(text)
    else toast.error(text)
  }, [])
  const value = useMemo(() => push, [push])
  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toaster
        theme={theme.resolved}
        position="bottom-right"
        duration={4200}
        closeButton
        toastOptions={{
          className: 'rounded-lg border border-line bg-paper-2 text-ink shadow-lg',
        }}
      />
    </ToastContext.Provider>
  )
}

export function useToast(): (tone: 'ok' | 'error', text: string) => void {
  const push = useContext(ToastContext)
  if (!push) throw new Error('useToast must be used inside ToastProvider.')
  return push
}
