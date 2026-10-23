import { expect, test, type Page } from '@playwright/test'

const sections = [
  { name: 'Watchlist', proof: /active items|Nothing to watch yet/ },
  { name: 'Deals', proof: /Grouped by the checker|No deals yet/ },
  { name: 'Stores', proof: /enabled stores|No stores on the list/ },
  { name: 'Analytics', proof: '90 days' },
] as const

async function openSection(page: Page, name: string) {
  const nav = page.getByRole('navigation', { name: 'Primary' })
  await nav.getByRole('link', { name, exact: name !== 'Deals' }).click()
}

async function expectSection(page: Page, name: string, proof: string | RegExp) {
  const heading = page.getByRole('heading', { level: 1, name, exact: true })
  await expect(heading).toBeVisible()
  await expect(page.getByText(proof).first()).toBeVisible()
  // Exit-then-enter is about 440ms. A stalled transition is invisible by then and stays that way.
  await page.waitForTimeout(800)
  await expect(heading).toBeVisible()
  await expect(page.getByText(proof).first()).toBeVisible()
  const opacity = await page.locator('#content > div').first().evaluate((node) => Number(getComputedStyle(node).opacity))
  expect(opacity).toBeGreaterThan(0.95)
}

async function visitAll(page: Page) {
  for (const section of sections) {
    await openSection(page, section.name)
    await expectSection(page, section.name, section.proof)
  }
}

test('sidebar navigation renders each page without a reload', async ({ page }) => {
  await page.goto('/deal-tracker/')
  await expectSection(page, 'Watchlist', sections[0].proof)
  await page.evaluate(() => {
    ;(window as unknown as { __harbourClient?: boolean }).__harbourClient = true
  })
  await visitAll(page)
  await visitAll(page)
  const stillClient = await page.evaluate(() => (window as unknown as { __harbourClient?: boolean }).__harbourClient === true)
  expect(stillClient).toBe(true)
  await expect(page).toHaveURL(/\/deal-tracker\/analytics$/)
})

test('mobile navigation renders each page', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/deal-tracker/')
  await expectSection(page, 'Watchlist', sections[0].proof)
  await visitAll(page)
})

test('direct links and reloads render', async ({ page }) => {
  const paths = ['/deal-tracker/deals', '/deal-tracker/stores', '/deal-tracker/analytics', '/deal-tracker/']
  for (const path of paths) {
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    const opacity = await page.locator('#content > div').first().evaluate((node) => Number(getComputedStyle(node).opacity))
    expect(opacity).toBeGreaterThan(0.95)
  }

  await page.goto('/deal-tracker/')
  await expect(page.getByRole('heading', { level: 1, name: 'Watchlist' })).toBeVisible()
  const item = page.locator('#content a[href*="/items/"]').first()
  if (await item.count()) {
    const href = await item.getAttribute('href')
    expect(href).toContain('/items/')
    await page.goto(href ?? '/deal-tracker/')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await page.reload()
    await expect(page).toHaveURL(/\/items\//)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  }
})

test('reduced motion and dark mode keep pages visible', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' })
  await page.goto('/deal-tracker/')
  await expectSection(page, 'Watchlist', sections[0].proof)

  await page.getByRole('button', { name: 'Colour theme' }).click()
  await page.getByRole('menuitemradio', { name: 'Dark' }).click()
  await page.keyboard.press('Escape')
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark')
  const background = await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor)
  expect(background).toBe('rgb(13, 16, 20)')

  await visitAll(page)
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark')

  await page.getByRole('button', { name: 'Colour theme' }).click()
  await page.getByRole('menuitemradio', { name: 'Light' }).click()
  await page.keyboard.press('Escape')
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe('light')
  await openSection(page, 'Deals')
  await expectSection(page, 'Deals', sections[1].proof)
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe('light')
})
