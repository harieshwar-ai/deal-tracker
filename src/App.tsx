import { Component, lazy } from 'react'
import type { ReactNode } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthProvider'
import { Shell } from './components/Shell'
import { ToastProvider } from './components/toast'
import { Button } from './components/ui'
import { routerBasename } from './lib/config'
import { LoginPage } from './pages/LoginPage'
import { previewRequested } from './preview/mode'
import { PreviewCatalogProvider, RemoteCatalogProvider } from './state/catalog'

const WatchlistPage = lazy(() => import('./pages/WatchlistPage').then((module) => ({ default: module.WatchlistPage })))
const DealsPage = lazy(() => import('./pages/DealsPage').then((module) => ({ default: module.DealsPage })))
const StoresPage = lazy(() => import('./pages/StoresPage').then((module) => ({ default: module.StoresPage })))
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage').then((module) => ({ default: module.AnalyticsPage })))
const ItemPage = lazy(() => import('./pages/ItemPage').then((module) => ({ default: module.ItemPage })))

interface BoundaryState {
  message: string | null
}

class AppErrorBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  state: BoundaryState = { message: null }

  static getDerivedStateFromError(error: unknown): BoundaryState {
    return { message: error instanceof Error ? error.message : 'Something went wrong.' }
  }

  render() {
    if (this.state.message) {
      return (
        <main className="mx-auto max-w-lg px-6 py-24">
          <h1 className="font-display text-4xl">Harbour hit a snag</h1>
          <p className="mt-3 text-sm leading-6 text-muted">{this.state.message}</p>
          <Button className="mt-6" onClick={() => window.location.reload()}>Reload</Button>
        </main>
      )
    }
    return this.props.children
  }
}

function PublicApp() {
  const preview = previewRequested()
  const { ready } = useAuth()
  if (!preview && !ready) {
    return (
      <main className="grid min-h-screen place-items-center">
        <p className="font-display text-3xl">Harbour</p>
      </main>
    )
  }
  const Provider = preview ? PreviewCatalogProvider : RemoteCatalogProvider
  return (
    <Provider>
      <Shell />
    </Provider>
  )
}

const router = createBrowserRouter(
  [
    { path: '/signin', element: <LoginPage /> },
    {
      path: '/',
      element: <PublicApp />,
      children: [
        { index: true, element: <WatchlistPage /> },
        { path: 'deals', element: <DealsPage /> },
        { path: 'stores', element: <StoresPage /> },
        { path: 'analytics', element: <AnalyticsPage /> },
        { path: 'items/:itemId', element: <ItemPage /> },
      ],
    },
  ],
  { basename: routerBasename },
)

export function App() {
  return (
    <AppErrorBoundary>
      <AuthProvider>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </AuthProvider>
    </AppErrorBoundary>
  )
}
