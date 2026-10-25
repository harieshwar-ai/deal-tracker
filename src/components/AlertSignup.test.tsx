// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AlertSignupDialog } from './AlertSignup'

const itemId = '11111111-1111-4111-8111-111111111111'

beforeEach(() => {
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
    await user.click(screen.getByRole('button', { name: 'Email me a confirmation' }))
    expect(screen.getByRole('alert').textContent).toContain('Enter a valid email address.')
    expect(onSubmit).not.toHaveBeenCalled()

    await user.type(screen.getByLabelText('Email'), 'ada@example.com')
    await user.click(screen.getByRole('button', { name: 'Email me a confirmation' }))
    expect(screen.getByRole('alert').textContent).toContain('Consent is required.')
    expect(onSubmit).not.toHaveBeenCalled()

    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('radio', { name: 'A category' }))
    await user.type(screen.getByLabelText('Category'), 'gpu')
    await user.click(screen.getByRole('button', { name: 'Email me a confirmation' }))
    expect(onSubmit).toHaveBeenCalledWith({ email: 'ada@example.com', itemId: null, category: 'gpu' })
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
    expect(onSubmit).toHaveBeenCalledWith({ email: 'ada@example.com', itemId, category: null })

    cleanup()
    const categorySubmit = renderDialog({
      items: [],
      preset: { itemId, itemName: 'Office chair', category: 'chairs' },
    })
    await user.type(screen.getByLabelText('Email'), 'ada@example.com')
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('radio', { name: 'The chairs category' }))
    await user.click(screen.getByRole('button', { name: 'Email me a confirmation' }))
    expect(categorySubmit).toHaveBeenCalledWith({ email: 'ada@example.com', itemId: null, category: 'chairs' })
  })
})
