import { BarChart3, List, LogOut, RefreshCw, Store, Tag, Users } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { consumeReturnPath, rememberReturnPath } from '../auth/returnPath'
import { cn } from '../lib/cn'
import { leavePreview } from '../preview/mode'
import { openGoodDeals } from '../domain/overview'
import { useCatalog } from '../state/catalog'
import { RouteTransition } from './motion'
import { useAlertSignup } from './AlertSignup'
import { ThemeToggle } from './ThemeToggle'
import { LoadingBlock } from './ui/skeleton'
import { Tooltip } from './ui/tooltip'

const navEase = [0.2, 0, 0, 1] as const

const links = [
  { to: '/', label: 'Watchlist', icon: List, end: true },
  { to: '/deals', label: 'Deals', icon: Tag, end: false },
  { to: '/stores', label: 'Stores', icon: Store, end: false },
  { to: '/analytics', label: 'Analytics', icon: BarChart3, end: false },
]

export function Shell() {
  const { email, notice, signOut, session } = useAuth()
  const catalog = useCatalog()
  const navigate = useNavigate()
  const consumed = useRef(false)
  const openDeals = openGoodDeals(catalog).length
  const openAlerts = useAlertSignup()

  useEffect(() => {
    if (!session || consumed.current) return
    consumed.current = true
    const next = consumeReturnPath()
    if (next) navigate(next, { replace: true })
  }, [navigate, session])

  async function exit() {
    if (catalog.source === 'preview') {
      leavePreview()
      return
    }
    await signOut()
  }

  return (
    <div className="min-h-screen md:grid md:grid-cols-[16.5rem_minmax(0,1fr)]">
      <a href="#content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-3 focus:rounded-full focus:bg-paper-2 focus:px-3 focus:py-2">
        Skip to content
      </a>
      <aside className="hidden bg-bark text-foam md:flex md:flex-col md:px-4 md:py-6">
        <div className="px-3">
          <p className="font-display text-3xl">Harbour</p>
          <p className="mt-1 text-sm text-foam/60">Hamilton · CAD</p>
        </div>
        <nav className="mt-8 grid gap-1" aria-label="Primary">
          {links.map((link) => (
            <NavItem key={link.to} {...link} count={link.to === '/deals' ? openDeals : 0} />
          ))}
          {session && catalog.source !== 'preview' ? (
            <NavItem to="/alerts" label="Subscribers" icon={Users} end={false} count={0} />
          ) : null}
        </nav>
        {catalog.source === 'preview' ? (
          <p className="mt-auto px-3 pt-6 text-sm text-foam/70">Sample data</p>
        ) : null}
      </aside>
      <div className="min-w-0">
        <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-4 py-3 md:px-8">
          <div className="flex items-center gap-3">
            <p className="font-display text-2xl md:hidden">Harbour</p>
            {session && catalog.source !== 'preview' ? (
              <Link to="/alerts" className="text-sm text-muted underline md:hidden">Subscribers</Link>
            ) : null}
            <button type="button" className="text-sm text-ink underline decoration-line underline-offset-4" onClick={() => openAlerts()}>
              Deal alerts
            </button>
          </div>
          <p className="hidden text-sm text-muted md:block">
            {catalog.source === 'preview' ? 'Sample data on this browser. Refresh restores it.' : 'Prices from the daily Canadian store check.'}
          </p>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <Tooltip label={catalog.source === 'preview' ? 'Reset sample data' : 'Refresh'}>
              <button
                type="button"
                className="rounded-lg p-2 text-muted hover:bg-paper"
                onClick={() => void catalog.refresh()}
                aria-label={catalog.source === 'preview' ? 'Reset sample data' : 'Refresh'}
              >
                <RefreshCw className={cn('h-4 w-4', catalog.refreshing && 'animate-spin')} />
              </button>
            </Tooltip>
            {catalog.source === 'preview' ? (
              <>
                <span className="hidden max-w-48 truncate text-sm text-muted sm:inline">Preview</span>
                <Tooltip label="Leave preview">
                  <button type="button" className="rounded-lg p-2 text-muted hover:bg-paper" onClick={() => void exit()} aria-label="Leave preview">
                    <LogOut className="h-4 w-4" />
                  </button>
                </Tooltip>
              </>
            ) : session ? (
              <>
                <span className="hidden max-w-48 truncate text-sm text-muted sm:inline">{email}</span>
                <Tooltip label="Sign out">
                  <button type="button" className="rounded-lg p-2 text-muted hover:bg-paper" onClick={() => void exit()} aria-label="Sign out">
                    <LogOut className="h-4 w-4" />
                  </button>
                </Tooltip>
              </>
            ) : (
              <Link to="/signin" className="shrink-0 whitespace-nowrap text-sm text-muted underline" onClick={() => rememberReturnPath()}>
                Owner sign-in
              </Link>
            )}
          </div>
        </header>
        {notice && catalog.source !== 'preview' ? (
          <p className="mx-4 mt-4 rounded-2xl border border-clay/30 bg-clay-soft px-4 py-3 text-sm md:mx-8">{notice}</p>
        ) : null}
        {catalog.error ? (
          <p className="mx-4 mt-4 rounded-2xl border border-clay/30 bg-clay-soft px-4 py-3 text-sm md:mx-8">
            {catalog.error}
          </p>
        ) : null}
        <main id="content" className="px-4 pt-6 pb-[calc(7rem+env(safe-area-inset-bottom))] md:px-8 md:pb-12">
          <RouteTransition fallback={<LoadingBlock />} />
        </main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-line bg-paper-2/95 shadow-[0_-8px_24px_rgb(16_20_24/0.04)] backdrop-blur pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="Primary">
        {links.map((link) => (
          <MobileNavItem key={link.to} {...link} count={link.to === '/deals' ? openDeals : 0} />
        ))}
      </nav>
    </div>
  )
}

function NavItem({
  to,
  label,
  icon: Icon,
  end,
  count,
}: {
  to: string
  label: string
  icon: typeof List
  end: boolean
  count: number
}) {
  const reduce = useReducedMotion()
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => cn('relative flex items-center justify-between rounded-lg px-3 py-2.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foam', isActive ? 'text-foam' : 'text-foam/70 hover:bg-white/5')}
    >
      {({ isActive }) => (
        <>
          {isActive ? (
            reduce ? (
              <span className="absolute inset-0 rounded-lg bg-white/10" />
            ) : (
              <motion.span
                layoutId="desktop-nav"
                className="absolute inset-0 rounded-lg bg-white/10"
                transition={{ type: 'tween', duration: 0.22, ease: navEase }}
              />
            )
          ) : null}
          <span className="relative inline-flex items-center gap-2">
            <Icon className="h-4 w-4" aria-hidden="true" />
            {label}
          </span>
          {count > 0 ? <span className="relative rounded-md bg-gold px-2 py-0.5 text-xs text-on-accent">{count}</span> : null}
        </>
      )}
    </NavLink>
  )
}

function MobileNavItem({
  to,
  label,
  icon: Icon,
  end,
  count,
}: {
  to: string
  label: string
  icon: typeof List
  end: boolean
  count: number
}) {
  const reduce = useReducedMotion()
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => cn('relative flex min-h-14 flex-col items-center justify-center gap-1 px-2 py-2 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-pine', isActive ? 'text-pine' : 'text-muted')}
    >
      {({ isActive }) => (
        <>
          {isActive ? (
            reduce ? (
              <span className="absolute inset-x-4 top-1 h-0.5 rounded-full bg-pine" />
            ) : (
              <motion.span
                layoutId="mobile-nav"
                className="absolute inset-x-4 top-1 h-0.5 rounded-full bg-pine"
                transition={{ type: 'tween', duration: 0.22, ease: navEase }}
              />
            )
          ) : null}
          <Icon className="h-5 w-5" aria-hidden="true" />
          {label}
          {count > 0 ? <span className="sr-only">{count} open</span> : null}
        </>
      )}
    </NavLink>
  )
}
