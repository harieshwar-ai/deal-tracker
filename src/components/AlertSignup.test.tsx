// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PRESET_COUNTRIES } from '../domain/country'
import { AlertSignupDialog } from './AlertSignup'

vi.mock('../state/country', () => ({
  useCountry: () => ({
    profile: PRESET_COUNTRIES[0],
    code: 'CA',
  }),
}))

const itemId = '11111111-1111-4111-8111-111111111111'

beforeEach(() => {
  Element.prototype.hasPointerCapture ??= () => false
  Element.prototype.setPointerCapture ??= () => {}
  Element.prototype.releasePointerCapture ??= () => {}
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent() { return false },
    }),
  })
  Element.prototype.scrollIntoView = () => {}
})

afterEach(() => cleanup())

function renderDialog(overrides: Partial<Parameters<typeof AlertSignupDialog>[0]> = {}) {
  const onSubmit = vi.fn()
  render(
    <AlertSignupDialog
      open
      pending={false}
      formError={null}
      items={[{ id: itemId, name: 'Office chair', category: 'chairs' }]}
      categories={['chairs', 'gpu']}
      preset={{}}
      onClose={() => {}}
      onSubmit={onSubmit}
      {...overrides}
    />,
  )
  return onSubmit
}

describe('deal alert dialog', () => {
  it('requires a valid email, consent, and one target', async () => {
    const user = userEvent.setup()
    const onSubmit = renderDialog()
    const submit = screen.getByRole('button', { name: 'Email me a confirmation' })
    expect((submit as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('checkbox') as HTMLInputElement).required).toBe(true)
    expect(onSubmit).not.toHaveBeenCalled()

    await user.click(screen.getByRole('checkbox'))
    expect((submit as HTMLButtonElement).disabled).toBe(false)
    await user.click(submit)
    expect(screen.getByRole('alert').textContent).toContain('Enter a valid email address.')
    expect(onSubmit).not.toHaveBeenCalled()

    await user.type(screen.getByLabelText('Email'), 'ada@example.com')
    await user.click(screen.getByRole('radio', { name: 'A category' }))
    await user.click(screen.getByRole('radio', { name: 'Graphics cards' }))
    await user.click(submit)
    expect(onSubmit).toHaveBeenCalledWith({ email: 'ada@example.com', itemId: null, category: 'gpu', countryCode: 'CA' })
  })

  it('offers All PC hardware above the live categories', async () => {
    const user = userEvent.setup()
    const onSubmit = renderDialog({
      categories: ['Chairs', 'Prebuilt PCs', 'Graphics cards', 'Memory (RAM)', 'SSDs'],
    })
    await user.type(screen.getByLabelText('Email'), 'ada@example.com')
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('radio', { name: 'A category' }))
    expect(screen.getByText('Groups')).toBeTruthy()
    expect(screen.getByText('Categories')).toBeTruthy()
    await user.click(screen.getByRole('radio', { name: 'All PC hardware' }))
    await user.click(screen.getByRole('button', { name: 'Email me a confirmation' }))
    expect(onSubmit).toHaveBeenCalledWith({ email: 'ada@example.com', itemId: null, category: 'group:pc-hardware', countryCode: 'CA' })
  })

  it('submits a product or its category from a product page', async () => {
    const user = userEvent.setup()
    const onSubmit = renderDialog({
      items: [],
      preset: { itemId, itemName: 'Office chair', category: 'chairs' },
    })
    await user.type(screen.getByLabelText('Email'), 'Ada@Example.com')
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: 'Email me a confirmation' }))
    expect(onSubmit).toHaveBeenCalledWith({ email: 'ada@example.com', itemId, category: null, countryCode: 'CA' })

    cleanup()
    const categorySubmit = renderDialog({
      items: [],
      preset: { itemId, itemName: 'Office chair', category: 'chairs' },
    })
    await user.type(screen.getByLabelText('Email'), 'ada@example.com')
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('radio', { name: 'The Chairs category' }))
    await user.click(screen.getByRole('button', { name: 'Email me a confirmation' }))
    expect(categorySubmit).toHaveBeenCalledWith({ email: 'ada@example.com', itemId: null, category: 'chairs', countryCode: 'CA' })
  })
})
