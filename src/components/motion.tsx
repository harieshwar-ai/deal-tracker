import { AnimatePresence, animate, motion, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'

const ease = [0.2, 0, 0, 1] as const

export function useTween(index = 0) {
  const reduce = useReducedMotion()
  const shift = Math.min(index, 10) * 0.03
  return {
    reduce: Boolean(reduce),
    transition: reduce
      ? { duration: 0 }
      : {
          type: 'tween' as const,
          duration: 0.22,
          ease,
          delay: shift,
          layout: { type: 'tween' as const, duration: 0.22, ease },
        },
  }
}

export function RouteTransition({ children }: { children: ReactNode }) {
  const location = useLocation()
  const reduce = useReducedMotion()
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduce ? undefined : { opacity: 0, y: -6 }}
        transition={reduce ? { duration: 0 } : { type: 'tween', duration: 0.22, ease }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}

export function FadeIn({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion()
  if (reduce) return children
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ type: 'tween', duration: 0.22, ease }}
    >
      {children}
    </motion.div>
  )
}

export function CountUp({
  value,
  format,
}: {
  value: number
  format: (value: number) => string
}) {
  const reduce = useReducedMotion()
  const [text, setText] = useState(() => format(value))
  useEffect(() => {
    if (reduce) {
      setText(format(value))
      return
    }
    const controls = animate(0, value, {
      type: 'tween',
      duration: 0.28,
      ease,
      onUpdate: (next) => setText(format(next)),
    })
    return () => controls.stop()
  }, [format, reduce, value])
  return text
}

export function MotionCard({
  index = 0,
  className,
  children,
}: {
  index?: number
  className?: string
  children: ReactNode
}) {
  const tween = useTween(index)
  return (
    <motion.div
      layout
      className={className}
      initial={tween.reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      whileHover={tween.reduce ? undefined : { y: -2 }}
      transition={tween.transition}
    >
      {children}
    </motion.div>
  )
}
