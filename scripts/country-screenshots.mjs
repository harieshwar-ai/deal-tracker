import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

const base = 'http://127.0.0.1:4173/deal-tracker/?preview=1'
const out = '/opt/cursor/artifacts/screenshots'

await mkdir(out, { recursive: true })
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })

await page.goto(`${base}&country=CA`)
await page.getByRole('heading', { name: 'Watchlist' }).waitFor({ timeout: 60_000 })
const country = page.getByRole('combobox', { name: 'Country' })
await country.waitFor()
await page.emulateMedia({ colorScheme: 'dark' })
await country.click()
await page.screenshot({ path: `${out}/overview-dark-picker-open.png`, fullPage: true })

await page.emulateMedia({ colorScheme: 'light' })
await country.click()
await page.screenshot({ path: `${out}/overview-light-picker-open.png`, fullPage: true })

await page.goto(`${base}&country=US`)
await page.getByRole('heading', { name: 'Watchlist' }).waitFor()
await page.getByText(/Prices coming soon/i).first().waitFor()
await page.screenshot({ path: `${out}/prices-coming-soon-united-states.png`, fullPage: true })

await page.goto(`${base}&country=CA`)
await page.getByRole('heading', { name: 'Watchlist' }).waitFor()
await page.getByRole('button', { name: "Don't see your country?" }).click()
await page.getByRole('heading', { name: 'Request your country' }).waitFor()
await page.screenshot({ path: `${out}/waitlist-dialog.png`, fullPage: true })

await page.setViewportSize({ width: 390, height: 844 })
await page.goto(`${base}&country=CA`)
await page.getByRole('heading', { name: 'Watchlist' }).waitFor()
await page.screenshot({ path: `${out}/mobile-overview.png`, fullPage: true })

await browser.close()
