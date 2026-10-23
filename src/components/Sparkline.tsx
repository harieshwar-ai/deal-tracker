import { formatCad } from '../domain/format'

export function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) {
    return <p className="text-xs text-muted">Not enough prices for a trend</p>
  }
  const width = 120
  const height = 36
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width
      const y = height - ((value - min) / span) * (height - 4) - 2
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  const first = values[0] ?? min
  const last = values[values.length - 1] ?? max
  const falling = last <= first
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Recent price moved from ${formatCad(first)} to ${formatCad(last)}`}
      className="shrink-0"
    >
      <polyline
        points={points}
        fill="none"
        stroke={falling ? 'var(--color-pine)' : 'var(--color-clay)'}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}
