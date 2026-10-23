import { BarChart3, List, LogOut, RefreshCw, Store, Tag } from 'lucide-react'
import { Suspense, useEffect, useRef } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { consumeReturnPath, rememberReturnPath } from '../auth/returnPath'
import { ThemeToggle } from './ThemeToggle'
import { LoadingBlock } from './ui'
import { cn } from '../lib/cn'
import { leavePreview } from '../preview/mode'
import { useCatalog } from '../state/catalog'

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
  const openDeals = catalog.deals.filter((deal) => deal.status === 'open').length

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
        </nav>
        <div className="mt-auto px-3 pt-6 text-sm text-foam/70">
          {catalog.source === 'preview' ? 'Sample data' : session ? 'Owner' : (
            <Link to="/signin" className="underline" onClick={() => rememberReturnPath()}>Owner sign-in</Link>
          )}
        </div>
      </aside>
      <div className="min-w-0">
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 md:px-8">
          <p className="font-display text-2xl md:hidden">Harbour</p>
          <p className="hidden text-sm text-muted md:block">
            {catalog.source === 'preview' ? 'Sample data on this browser. Refresh restores it.' : 'Prices from the daily Canadian store check.'}
          </p>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <button
              type="button"
              className="rounded-full p-2 text-muted hover:bg-paper"
              onClick={() => void catalog.refresh()}
              aria-label={catalog.source === 'preview' ? 'Reset sample data' : 'Refresh'}
            >
              <RefreshCw className={cn('h-4 w-4', catalog.refreshing && 'animate-spin')} />
            </button>
            {catalog.source === 'preview' ? (
              <>
                <span className="hidden max-w-48 truncate text-sm text-muted sm:inline">Preview</span>
                <button type="button" className="rounded-full p-2 text-muted hover:bg-paper" onClick={() => void exit()} aria-label="Leave preview">
                  <LogOut className="h-4 w-4" />
                </button>
              </>
            ) : session ? (
              <>
                <span className="hidden max-w-48 truncate text-sm text-muted sm:inline">{email}</span>
                <button type="button" className="rounded-full p-2 text-muted hover:bg-paper" onClick={() => void exit()} aria-label="Sign out">
                  <LogOut className="h-4 w-4" />
                </button>
              </>
            ) : (
              <Link to="/signin" className="text-sm text-muted underline" onClick={() => rememberReturnPath()}>
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
          <Suspense fallback={<LoadingBlock />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-line bg-paper-2 pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="Primary">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) => cn('flex min-h-14 flex-col items-center justify-center gap-1 px-2 py-2 text-xs', isActive ? 'text-pine' : 'text-muted')}
          >
            <link.icon className="h-5 w-5" aria-hidden="true" />
            {link.label}
            {link.to === '/deals' && openDeals > 0 ? <span className="sr-only">{openDeals} open</span> : null}
          </NavLink>
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
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => cn('flex items-center justify-between rounded-2xl px-3 py-2.5 text-sm', isActive ? 'bg-white/10 text-foam' : 'text-foam/70 hover:bg-white/5')}
    >
      <span className="inline-flex items-center gap-2">
        <Icon className="h-4 w-4" aria-hidden="true" />
        {label}
      </span>
      {count > 0 ? <span className="rounded-full bg-gold px-2 py-0.5 text-xs text-on-accent">{count}</span> : null}
    </NavLink>
  )
}
