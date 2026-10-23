import * as Dialog from '@radix-ui/react-dialog'
import { motion, useReducedMotion } from 'motion/react'
import { X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Button } from './button'

const ease = [0.2, 0, 0, 1] as const
const hidden = { opacity: 0, x: '-50%', y: 'calc(-50% + 8px)', scale: 0.98 }
const visible = { opacity: 1, x: '-50%', y: '-50%', scale: 1 }

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
  const reduce = useReducedMotion()
  const [shown, setShown] = useState(open)
  useEffect(() => {
    if (open) setShown(true)
  }, [open])
  const tween = useMemo(
    () => ({ type: 'tween' as const, duration: reduce ? 0 : 0.22, ease }),
    [reduce],
  )

  return (
    <Dialog.Root
      open={shown}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      {shown ? (
        <Dialog.Portal forceMount>
          <Dialog.Overlay asChild forceMount>
            <motion.div
              className="fixed inset-0 z-40 bg-bark/55"
              initial={false}
              animate={{ opacity: open ? 1 : 0 }}
              transition={tween}
            />
          </Dialog.Overlay>
          <Dialog.Content asChild forceMount>
            <motion.div
              className="fixed top-1/2 left-1/2 z-50 max-h-[min(92vh,46rem)] w-[min(calc(100%-1.5rem),40rem)] overflow-y-auto rounded-xl border border-line bg-paper-2 p-5 shadow-xl focus:outline-none md:p-6"
              initial={reduce ? false : hidden}
              animate={open ? visible : hidden}
              transition={tween}
              onAnimationComplete={() => {
                if (!open) setShown(false)
              }}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Dialog.Title className="font-display text-2xl leading-none">{title}</Dialog.Title>
                  {description ? (
                    <Dialog.Description className="mt-2 text-sm text-muted">{description}</Dialog.Description>
                  ) : (
                    <Dialog.Description className="sr-only">{title}</Dialog.Description>
                  )}
                </div>
                <Dialog.Close className="rounded-md p-2 text-muted transition-colors duration-200 hover:bg-paper" aria-label="Close">
                  <X className="h-4 w-4" />
                </Dialog.Close>
              </div>
              <div className="mt-5">{children}</div>
            </motion.div>
          </Dialog.Content>
        </Dialog.Portal>
      ) : null}
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
