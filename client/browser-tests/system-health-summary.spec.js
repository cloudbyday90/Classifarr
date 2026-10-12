/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect } from '@playwright/test'

for (const width of [390, 1280]) {
  test(`health summary remains explicit and accessible at ${width}px`, async ({ page }, testInfo) => {
    const requests = [], errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.route(url => url.pathname.startsWith('/api/'), async route => {
      requests.push(route.request().method())
      await route.abort()
    })
    await page.setViewportSize({ width, height: 844 })
    await page.goto('/browser-tests/fixtures/system-health-summary.html')
    const status = page.getByRole('status')
    await expect(status).toHaveAttribute('aria-atomic', 'true')
    await expect(status).toContainText('Health status incomplete')
    await expect(status).not.toContainText('2026-10-12')
    for (const [mode, message] of [['inactive', 'No active services to assess'], ['healthy', 'All active services reported healthy'], ['failed', 'Health summary unavailable']]) {
      const button = page.getByRole('button', { name: mode, exact: true })
      await button.focus()
      await page.keyboard.press('Enter')
      await expect(status).toContainText(message)
      await expect(button).toBeFocused()
    }
    await expect(status).toContainText('Showing last received results; current health is not verified.')
    await expect(page.getByText(/Results received \(UTC\):/)).toBeVisible()
    expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath('health-summary.png'), fullPage: true })
    expect(requests).toEqual([])
    expect(errors).toEqual([])
  })
}
