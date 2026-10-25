import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { isOwnerSession } from '../auth/owner'
import { rememberReturnPath } from '../auth/returnPath'
import { FadeIn } from '../components/motion'
import { Badge } from '../components/ui/badge'
import { EmptyState, LoadingBlock } from '../components/ui/skeleton'
import { loadSubscribers } from '../data/alerts'
import { subscriberCounts, type SubscriberListItem } from '../domain/alerts'
import { categoryLabel } from '../domain/labels'
import { useDocumentTitle } from '../lib/title'
import { useCatalog } from '../state/catalog'

const statusCopy = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  unsubscribed: 'Unsubscribed',
} as const

export function SubscribersPage() {
  useDocumentTitle('Subscribers')
  const { ready, session } = useAuth()
  const catalog = useCatalog()
  const owner = isOwnerSession(session?.user.id)
  const [rows, setRows] = useState<SubscriberListItem[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!owner) return
    let active = true
    void loadSubscribers().then((result) => {
      if (!active) return
      if (!result.ok) {
        setFailed(true)
        setRows([])
        return
      }
      setRows(result.rows)
    })
    return () => {
      active = false
    }
  }, [owner])

  if (!ready) return <LoadingBlock label="Loading subscribers…" />
  if (!owner) {
    return (
      <EmptyState
        title="Subscribers"
        body="Sign in as the owner to view subscribers."
        action={<Link className="text-sm text-pine underline" to="/signin" onClick={() => rememberReturnPath()}>Owner sign-in</Link>}
      />
    )
  }
  if (!rows) return <LoadingBlock label="Loading subscribers…" />
  if (failed) {
    return <EmptyState title="Subscribers" body="Subscriber storage is not available yet." />
  }

  const counts = subscriberCounts(rows)
  const names = new Map(catalog.items.map((item) => [item.id, item.name]))
  return (
    <FadeIn>
      <div>
        <h1 className="font-display text-4xl">Subscribers</h1>
        <p className="mt-2 text-sm text-muted">
          {counts.confirmed} confirmed · {counts.pending} pending · {counts.unsubscribed} unsubscribed
        </p>
        {rows.length === 0 ? (
          <div className="mt-8">
            <EmptyState title="No subscribers yet" body="Addresses show up here after someone asks for a deal alert." />
          </div>
        ) : (
          <>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <CountCard title="By category" rows={counts.byCategory.map((row) => ({ id: row.category, label: categoryLabel(row.category), count: row.count }))} empty="No category alerts yet." />
              <CountCard title="By product" rows={counts.byItem.map((row) => ({ id: row.itemId, label: names.get(row.itemId) ?? 'Removed item', count: row.count }))} empty="No product alerts yet." />
            </div>
            <div className="mt-6 overflow-x-auto rounded-xl border border-line bg-paper-2 shadow-sm">
              <table className="w-full min-w-[36rem] text-left text-sm">
                <thead className="border-b border-line text-muted">
                  <tr>
                    <th className="px-4 py-3 font-medium">Email</th>
                    <th className="px-4 py-3 font-medium">Alert</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b border-line last:border-0">
                      <td className="px-4 py-3">{row.email}</td>
                      <td className="px-4 py-3">{row.itemId ? (names.get(row.itemId) ?? 'Removed item') : categoryLabel(row.category)}</td>
                      <td className="px-4 py-3">
                        <Badge className="bg-paper text-ink">{statusCopy[row.status]}</Badge>
                        <span className="sr-only"> </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </FadeIn>
  )
}

function CountCard({ title, rows, empty }: { title: string; rows: { id: string; label: string; count: number }[]; empty: string }) {
  return (
    <section className="rounded-xl border border-line bg-paper-2 p-4 shadow-sm">
      <h2 className="font-display text-2xl">{title}</h2>
      {rows.length === 0 ? <p className="mt-3 text-sm text-muted">{empty}</p> : (
        <ul className="mt-3 grid gap-2">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-3 text-sm">
              <span>{row.label}</span>
              <span className="font-mono tabular-nums">{row.count}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
