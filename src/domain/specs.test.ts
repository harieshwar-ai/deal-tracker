import { describe, expect, it } from 'vitest'
import { parseRequirementList, parseSpecList, requirementMet } from './specs'
import type { ItemSpec } from './types'

const chair: ItemSpec[] = [
  { name: 'Tilt', value: 'Frog tilt with multi-angle lock' },
  { name: 'Weight rating', value: '150 kg' },
  { name: 'Gas lift', value: 'Class 4' },
]

describe('spec requirements', () => {
  it('passes an owner requirement when the public specs cover it', () => {
    expect(requirementMet({ label: 'True frog tilt' }, chair)).toBe(true)
    expect(requirementMet({ label: '150 kg rating' }, chair)).toBe(true)
    expect(requirementMet({ label: 'Class 4 lift' }, chair)).toBe(true)
  })

  it('fails when the spec text does not contain the requirement', () => {
    expect(requirementMet({ label: 'Memory foam' }, chair)).toBe(false)
    expect(requirementMet({ label: 'Class 4 lift' }, [{ name: 'Weight', value: '40 kg' }])).toBe(false)
    expect(requirementMet({ label: 'True frog tilt' }, [])).toBe(false)
  })

  it('ignores malformed spec payloads', () => {
    expect(parseSpecList([{ name: 'Tilt', value: 'Frog' }, { name: '' }, 'nope', null])).toEqual([
      { name: 'Tilt', value: 'Frog' },
    ])
    expect(parseRequirementList([{ label: 'Class 4 lift' }, { label: '  ' }])).toEqual([
      { label: 'Class 4 lift' },
    ])
  })
})
