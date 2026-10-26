import { expect, test } from '@playwright/test'

test.describe('country picker', () => {
  test('persists country in the URL and opens the waitlist dialog', async ({ page }) => {
    await page.goto('/deal-tracker/?country=CA')
    await page.getByLabel('Country').click()
    await page.getByRole('option', { name: /United States/ }).click()
    await expect(page.getByText(/Prices coming soon/i).first()).toBeVisible()
    await page.getByRole('button', { name: "Don't see your country?" }).click()
    await expect(page.getByRole('heading', { name: 'Request your country' })).toBeVisible()
    await page.getByRole('button', { name: 'Cancel' }).click()
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(page.getByLabel('Country')).toBeVisible()
  })
})
