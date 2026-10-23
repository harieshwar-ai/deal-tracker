import * as AccordionPrimitive from '@radix-ui/react-accordion'
import { ChevronDown } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import type { ComponentProps, ReactNode } from 'react'
import { cn } from '../../lib/cn'

const ease = [0.2, 0, 0, 1] as const

export function Accordion(props: ComponentProps<typeof AccordionPrimitive.Root>) {
  return <AccordionPrimitive.Root {...props} />
}

export function AccordionItem({ className, ...props }: ComponentProps<typeof AccordionPrimitive.Item>) {
  return <AccordionPrimitive.Item className={cn('rounded-xl border border-line bg-paper-2 px-4 shadow-sm', className)} {...props} />
}

export function AccordionTrigger({ className, children, ...props }: ComponentProps<typeof AccordionPrimitive.Trigger>) {
  return (
    <AccordionPrimitive.Header>
      <AccordionPrimitive.Trigger
        className={cn(
          'flex w-full items-center justify-between gap-3 py-3 text-left text-sm font-medium transition-colors duration-200 hover:text-pine [&[data-state=open]>svg]:rotate-180',
          className,
        )}
        {...props}
      >
        {children}
        <ChevronDown className="h-4 w-4 shrink-0 text-muted transition-transform duration-200" />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  )
}

function MotionPanel({
  className,
  children,
  ...props
}: {
  className?: string
  children?: ReactNode
  'data-state'?: string
}) {
  const reduce = useReducedMotion()
  const state = props['data-state']
  return (
    <motion.div
      {...props}
      inert={state === 'open' ? undefined : true}
      className={cn('overflow-hidden', className)}
      initial={false}
      animate={state === 'open' ? 'open' : 'closed'}
      variants={{
        open: { height: 'auto', opacity: 1 },
        closed: { height: 0, opacity: 0 },
      }}
      transition={reduce ? { duration: 0 } : { type: 'tween', duration: 0.22, ease }}
    >
      <div className="pb-3">{children}</div>
    </motion.div>
  )
}

export function AccordionContent({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <AccordionPrimitive.Content forceMount asChild>
      <MotionPanel className={className}>{children}</MotionPanel>
    </AccordionPrimitive.Content>
  )
}
