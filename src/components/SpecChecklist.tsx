import { requirementMet } from '../domain/specs'
import type { ItemRequirement, ItemSpec } from '../domain/types'

export function SpecChecklist({ specs }: { specs: ItemSpec[] }) {
  if (specs.length === 0) return null
  return (
    <ul className="mt-3 grid gap-1">
      {specs.map((spec) => (
        <li key={`${spec.name}\u0000${spec.value}`} className="flex gap-2 text-sm leading-6">
          <span className="text-pine" aria-hidden="true">✓</span>
          <span>
            <span className="text-muted">{spec.name}.</span> {spec.value}
          </span>
        </li>
      ))}
    </ul>
  )
}

export function RequirementChecklist({
  specs,
  requirements,
}: {
  specs: ItemSpec[]
  requirements: ItemRequirement[]
}) {
  if (requirements.length === 0) return null
  return (
    <section className="mt-4 max-w-2xl rounded-2xl bg-paper px-4 py-3">
      <h2 className="text-sm font-semibold">Your requirements</h2>
      <ul className="mt-2 grid gap-1">
        {requirements.map((requirement, index) => {
          const met = requirementMet(requirement, specs)
          return (
            <li key={`${requirement.label}-${index}`} className="flex gap-2 text-sm leading-6">
              <span className={met ? 'text-pine' : 'text-clay'}>{met ? 'Pass' : 'Fail'}</span>
              <span>{requirement.label}</span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
