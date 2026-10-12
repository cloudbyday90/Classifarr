/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@playwright/test'

for (const [mode, label] of [
  ['match', 'CPU match reported at startup'],
  ['mismatch', 'CPU mismatch reported at startup'],
  ['unknown', 'Compatibility unknown'],
  ['stale', 'Compatibility unknown'],
  ['generic', 'Generic selected at startup'],
]) {
  test(`startup ${mode} is not service health`, async ({ page }, testInfo) => {
    const requests = [], errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.route(url => url.pathname.startsWith('/api/'), async route => {
      requests.push(route.request().method())
      await route.abort()
    })
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`/browser-tests/fixtures/pgvector-startup.html?mode=${mode}`)
    await expect(page.getByRole('region', { name: 'pgvector startup compatibility' })).toBeVisible()
    await expect(page.getByTestId('pgvector-compatibility-label')).toHaveText(label)
    await expect(page.getByText(/not included in service-health totals/)).toBeVisible()
    await expect(page.getByText(/not a loaded-binary or database-health check/)).toBeVisible()
    await expect(page.getByText('12345678-1234-4567-8123-123456789abc')).toBeVisible()
    await expect(page.getByText('2026-10-12T14:59:00.000Z')).toBeVisible()
    await expect(page.getByText('Healthy', { exact: true })).toHaveCount(0)
    if (mode === 'stale') await expect(page.getByText(/Saved by another application process/)).toBeVisible()
    expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath('startup-mobile.png'), fullPage: true })
    await page.setViewportSize({ width: 1280, height: 900 })
    await expect(page.getByTestId('pgvector-compatibility-label')).toBeVisible()
    expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth)).toBe(true)
    expect(requests).toEqual([])
    expect(errors).toEqual([])
  })
}
