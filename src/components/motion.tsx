import { AnimatePresence, animate, motion, useIsPresent, useReducedMotion } from 'motion/react'
import { Suspense, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useLocation, useOutlet } from 'react-router-dom'

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

export function RouteTransition({ fallback = null }: { fallback?: ReactNode }) {
  const location = useLocation()
  // Freeze the matched route element. A live <Outlet /> swaps in the next page
  // while this node is still exiting, so the next page's layout projections
  // subscribe to an exit that never finishes and mode="wait" never reveals it.
  const outlet = useOutlet()
  const reduce = useReducedMotion()
  // Reduced motion still needs an exit definition. `exit={undefined}` never
  // resolves, and mode="wait" then keeps the previous page on screen.
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduce ? { opacity: 1 } : { opacity: 0, y: -6 }}
        transition={reduce ? { duration: 0 } : { type: 'tween', duration: 0.22, ease }}
      >
        <Suspense fallback={fallback}>{outlet}</Suspense>
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
  const finalText = format(value)
  const animateValue = reduce === false
  const [text, setText] = useState(finalText)
  const [settled, setSettled] = useState(!animateValue)
  useEffect(() => {
    if (!animateValue) {
      setText(finalText)
      setSettled(true)
      return
    }
    setSettled(false)
    const controls = animate(0, value, {
      type: 'tween',
      duration: 0.28,
      ease,
      onUpdate: (next) => setText(format(next)),
      onComplete: () => setSettled(true),
    })
    return () => controls.stop()
  }, [animateValue, finalText, format, value])
  const shown = animateValue ? text : finalText
  return (
    <span data-count-settled={settled ? 'true' : 'false'} aria-label={finalText}>
      <span aria-hidden="true">{shown}</span>
    </span>
  )
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
  // Layout projection under a route exit never finishes its safeToRemove
  // callback, so AnimatePresence mode="wait" keeps the previous page mounted.
  const present = useIsPresent()
  return (
    <motion.div
      layout={present && !tween.reduce}
      className={className}
      initial={tween.reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={tween.reduce ? undefined : { y: -2 }}
      transition={tween.transition}
    >
      {children}
    </motion.div>
  )
}
