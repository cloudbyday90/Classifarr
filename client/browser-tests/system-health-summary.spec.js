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
    const overdue = page.getByRole('button', { name: 'overdue', exact: true })
    await overdue.focus()
    await page.keyboard.press('Enter')
    await expect(status).toContainText('Automatic health checks are paused')
    await expect(page.getByText(/Check overdue. Use Refresh/)).toBeVisible()
    await expect(page.getByText(/Last reported status: Unhealthy/)).toBeVisible()
    await expect(page.getByText(/Freshness deadline \(UTC\):/)).toBeVisible()
    await expect(status).not.toContainText('2026-10-12')
    await expect(overdue).toBeFocused()
    expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth)).toBe(true)
    const information = page.getByTestId('pgvector-startup-panel')
    await expect(information.getByTestId('pgvector-version')).toHaveText('0.8.7')
    await expect(information.getByTestId('pgvector-selected-variant')).toHaveText('AVX2')
    await expect(information.locator('dt')).toHaveCount(5)
    await expect(information).not.toContainText('application process')
    await expect(information).not.toContainText('12345678-1234-4567-8123-123456789abc')
    await expect(information).not.toContainText('2026-10-12')
    const card = page.getByTestId('live-health-card')
    for (const [mode, label] of [['healthy', 'Healthy'], ['inactive', 'Not Configured'], ['unknown', 'Unknown']]) {
      await page.getByRole('button', { name: mode, exact: true }).click()
      await expect(card).toContainText(label)
      await card.hover()
      await expect(page.getByRole('tooltip')).toHaveText(`Fixture service\nStatus: ${label}`)
      await page.getByRole('heading', { name: 'System Information', exact: true }).hover()
      await expect(page.getByRole('tooltip')).toHaveCount(0)
      await card.hover()
      await expect(page.getByRole('tooltip')).toHaveText(`Fixture service\nStatus: ${label}`)
    }
    await expect(page.getByRole('tooltip')).toHaveCSS('opacity', '1')
    await page.screenshot({ path: testInfo.outputPath('health-summary.png'), fullPage: true })
    expect(requests).toEqual([])
    expect(errors).toEqual([])
  })
}
