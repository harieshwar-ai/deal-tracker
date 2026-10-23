import { guidanceRanges, seasonCards } from '../domain/seasons'
import { MotionCard } from './motion'

export function SeasonCards({ now = new Date() }: { now?: Date }) {
  const cards = seasonCards(now)
  return (
    <section className="mt-8" aria-label="Seasonal guidance">
      <h2 className="font-display text-2xl">Seasonal guidance</h2>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        General guidance, not Harbour data. The countdowns and discount ranges are not calculated from saved prices.
      </p>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        {cards.map((card, index) => (
          <MotionCard key={card.id} index={index} className="rounded-xl border border-line bg-paper-2 px-4 py-4 shadow-sm">
            <p className="text-xs uppercase tracking-[0.14em] text-muted">{card.name}</p>
            <p className="mt-2 font-display text-3xl">{card.days == null ? 'No date' : card.days === 0 ? 'Today' : `${card.days} days`}</p>
            <p className="mt-1 text-sm">{card.when}</p>
            <p className="mt-2 text-sm leading-6 text-muted">{card.detail}</p>
          </MotionCard>
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-2">
        {guidanceRanges.map((range) => (
          <li key={range.category} className="rounded-full border border-line px-3 py-1 text-sm">
            {range.category}: {range.range}
          </li>
        ))}
      </ul>
    </section>
  )
}
