import { formatRelative, formatToronto } from '../domain/format'
import { Tooltip } from './ui/tooltip'

export function RelativeTime({ iso }: { iso: string | null | undefined }) {
  if (!iso) return <span>—</span>
  return (
    <Tooltip label={formatToronto(iso)}>
      <time dateTime={iso} className="cursor-help tabular-nums underline decoration-dotted decoration-line underline-offset-4">
        {formatRelative(iso)}
      </time>
    </Tooltip>
  )
}
