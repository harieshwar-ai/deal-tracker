import { Link } from 'react-router-dom'
import { formatCad, formatRelative } from '../domain/format'
import { timelineLabel } from '../domain/timeline'
import type { TimelineEvent, TimelineKind } from '../domain/timeline'

export function TimelineList({ events, linkItems }: { events: TimelineEvent[]; linkItems: boolean }) {
  if (events.length === 0) {
    return <p className="text-sm text-muted">No price changes yet.</p>
  }
  return (
    <ol className="grid gap-2">
      {events.map((event) => (
        <li key={event.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-2xl border border-line bg-paper-2 px-3 py-2 text-sm">
          <p>
            <span className={tone(event.kind)}>{timelineLabel(event.kind)}</span>
            <span className="text-muted"> · </span>
            {linkItems ? <Link className="underline" to={`/items/${event.itemId}`}>{event.itemName}</Link> : <span>{event.itemName}</span>}
            <span> at {event.storeName}</span>
            {event.productName ? <span className="text-muted"> · {event.productName}</span> : null}
            {event.price != null ? <span> · {formatCad(event.price)}</span> : null}
            {event.previousPrice != null ? <span className="text-muted"> from {formatCad(event.previousPrice)}</span> : null}
          </p>
          <time className="font-medium text-muted" dateTime={event.at}>{formatRelative(event.at)}</time>
        </li>
      ))}
    </ol>
  )
}

function tone(kind: TimelineKind): string {
  switch (kind) {
    case 'drop':
    case 'new_low':
      return 'text-pine'
    case 'raise':
    case 'out_of_stock':
      return 'text-clay'
    case 'restock':
      return 'text-sea'
    default: {
      const neverKind: never = kind
      return neverKind
    }
  }
}
