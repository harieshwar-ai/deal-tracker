import { expect, test, type Page, type Route } from '@playwright/test'

const ownerId = 'ce399408-8885-49fd-a960-ce4479603aaa'
const subscriptionId = '44444444-4444-4444-8444-444444444444'

function corsHeaders(): Record<string, string> {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': '*',
    'access-control-allow-methods': 'POST, GET, OPTIONS',
    'content-type': 'application/json',
  }
}

async function fulfillJson(route: Route, body: unknown, status = 200) {
  if (route.request().method() === 'OPTIONS') {
    await route.fulfill({ status: 204, headers: corsHeaders() })
    return
  }
  await route.fulfill({ status, headers: corsHeaders(), body: JSON.stringify(body) })
}

function ownerJwt(): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url')
  const exp = Math.floor(Date.now() / 1000) + 60 * 60
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: ownerId, role: 'authenticated', aud: 'authenticated', exp })}.sig`
}

async function ownerSession(page: Page) {
  const session = {
    access_token: ownerJwt(),
    refresh_token: 'refresh-token',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: 'bearer',
    user: {
      id: ownerId,
      aud: 'authenticated',
      role: 'authenticated',
      email: 'owner@example.com',
      app_metadata: { provider: 'email', providers: ['email'] },
      user_metadata: {},
      created_at: '2026-01-01T00:00:00.000Z',
    },
  }
  await page.addInitScript((stored) => {
    localStorage.setItem('sb-ieohjxtkoiphewcfttuw-auth-token', JSON.stringify(stored))
  }, session)
  await page.route('**/auth/v1/**', (route) => fulfillJson(route, {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_in: 3600,
    token_type: 'bearer',
    user: session.user,
    id: ownerId,
    email: 'owner@example.com',
  }))
}

test('visitor can request, confirm, and unsubscribe with mocked tokens', async ({ page }) => {
  let confirmBody: { action?: string; subscription_id?: string; email?: string; token?: string } | null = null
  await page.route('**/rest/v1/rpc/subscribe_to_alerts', (route) => fulfillJson(route, {
    ok: true,
    result: 'pending',
    subscription_id: subscriptionId,
  }))
  await page.route('**/functions/v1/deal-alerts', async (route) => {
    confirmBody = JSON.parse(route.request().postData() ?? '{}') as typeof confirmBody
    await fulfillJson(route, { ok: true, sent: true })
  })
  await page.route('**/rest/v1/rpc/confirm_alert', (route) => fulfillJson(route, { ok: true, result: 'confirmed' }))
  await page.route('**/rest/v1/rpc/unsubscribe_alert', (route) => fulfillJson(route, { ok: true, result: 'unsubscribed' }))

  await page.goto('/deal-tracker/')
  await expect(page.getByRole('heading', { level: 1, name: 'Watchlist', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Deal alerts', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', { name: 'Get deal alerts' })).toBeVisible()
  await dialog.getByRole('textbox', { name: 'Email', exact: true }).fill('ada@example.com')
  await dialog.getByRole('radio', { name: 'A category' }).click()
  await dialog.getByRole('combobox', { name: 'Category', exact: true }).click()
  await page.getByRole('option', { name: 'PC Hardware' }).click()
  await dialog.getByRole('checkbox').check()
  await dialog.getByRole('button', { name: 'Email me a confirmation' }).click()
  await expect(page.getByText('Check your inbox to confirm')).toBeVisible()
  await expect.poll(() => confirmBody).toMatchObject({
    action: 'confirm',
    subscription_id: subscriptionId,
    email: 'ada@example.com',
  })
  expect(confirmBody?.token).toBeUndefined()

  await page.goto('/deal-tracker/confirm?token=confirm-token')
  await expect(page.getByRole('heading', { name: 'You’re confirmed' })).toBeVisible()
  await page.goto('/deal-tracker/unsubscribe?token=unsubscribe-token')
  await expect(page.getByRole('heading', { name: 'You’re unsubscribed' })).toBeVisible()
})

test('visitors do not load the subscriber list', async ({ page }) => {
  let sawSubscribers = false
  await page.route('**/rest/v1/alert_subscriptions*', async (route) => {
    sawSubscribers = true
    await fulfillJson(route, [])
  })
  await page.route('**/rest/v1/rpc/list_alert_subscribers', async (route) => {
    sawSubscribers = true
    await fulfillJson(route, [])
  })
  await page.goto('/deal-tracker/alerts')
  await expect(page.getByText('Sign in as the owner to view subscribers.')).toBeVisible()
  expect(sawSubscribers).toBe(false)
})

test('owner sees subscriber counts and addresses', async ({ page }) => {
  await ownerSession(page)
  let sawTokenSelect = false
  await page.route('**/rest/v1/alert_subscriptions*', async (route) => {
    sawTokenSelect = true
    await fulfillJson(route, [])
  })
  await page.route('**/rest/v1/rpc/list_alert_subscribers', (route) => fulfillJson(route, [
    {
      id: subscriptionId,
      email: 'harirmdeee@gmail.com',
      item_id: null,
      category: 'gpu',
      status: 'confirmed',
      created_at: '2026-10-24T15:00:00.000Z',
    },
    {
      id: '55555555-5555-4555-8555-555555555555',
      email: 'ada@example.com',
      item_id: null,
      category: 'ram',
      status: 'pending',
      created_at: '2026-10-24T16:00:00.000Z',
    },
  ]))
  await page.goto('/deal-tracker/alerts')
  await expect(page.getByRole('heading', { level: 1, name: 'Subscribers' })).toBeVisible()
  await expect(page.getByText('1 confirmed · 1 pending · 0 unsubscribed')).toBeVisible()
  await expect(page.getByText('harirmdeee@gmail.com')).toBeVisible()
  await expect(page.getByText('ada@example.com')).toBeVisible()
  await expect(page.getByText('Graphics cards')).toHaveCount(2)
  await expect(page.getByText('Memory (RAM)')).toHaveCount(2)
  await expect(page.getByText('gpu', { exact: true })).toHaveCount(0)
  await expect(page.getByText('No suitable key or wrong key type')).toHaveCount(0)
  await expect(page.getByText('Sign in as the owner to view subscribers.')).toHaveCount(0)
  expect(sawTokenSelect).toBe(false)
})
