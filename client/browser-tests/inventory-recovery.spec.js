/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@playwright/test'
import { inventoryRecoveryFixture, inventoryRecoveryPlexUrl } from '../src/__tests__/fixtures/inventoryRecovery.js'

test('read-only recovery is keyboard accessible, recovers missing links and fits a narrow viewport', async ({ page }, testInfo) => {
  let writes = 0, linkReads = 0, reject = false
  const report = inventoryRecoveryFixture(0, 3)
  report.movies = 2; report.tv = 1
  Object.assign(report.items[1], { title: 'Example TV series', mediaType: 'tv', libraryName: 'Shows',
    diagnosis: 'Provider connection failed', instruction: 'Existing metadata was preserved. A scheduled recheck will retry.', sourceReview: false })
  Object.assign(report.items[2], { title: 'Example review candidate', identityCheck: { checked_at: report.asOf, candidate_tmdb_id: 99 } })
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const path = new globalThis.URL(route.request().url()).pathname
    if (route.request().method() !== 'GET') writes++
    let data = {}, status = 200
    if (path === '/api/setup/status') data = { setupRequired: false }
    if (path === '/api/auth/me' || path === '/api/user/me') data = { id: 1, role: 'admin', username: 'operator' }
    if (path === '/api/notifications') data = { data: [] }
    if (path === '/api/notifications/active') data = []
    if (path === '/api/notifications/unread-count') data = { unread: 0 }
    if (path === '/api/inventory-recovery') { data = reject ? { error: 'denied' } : report; status = reject ? 403 : 200 }
    if (path.endsWith('/plex-link')) {
      linkReads++
      data = linkReads === 1 ? { status: 'unavailable', url: null } : { status: 'available', url: inventoryRecoveryPlexUrl }
    }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) })
  })
  await page.goto('/libraries/recovery')
  await expect(page.getByRole('heading', { name: 'Metadata recovery', exact: true })).toBeVisible()
  await expect(page.locator('dd')).toHaveText(['3', '2', '1'])
  expect(linkReads).toBe(0)
  const summary = page.locator('summary').first()
  await summary.focus(); await page.keyboard.press('Enter')
  await expect(page.getByText(/Plex link unavailable/)).toBeVisible()
  await page.getByRole('button', { name: 'Check Plex link again' }).click()
  await expect(page.getByRole('link', { name: 'Open Example movie 1 in Plex (new tab)' })).toHaveAttribute('href', inventoryRecoveryPlexUrl)
  await expect(summary).toHaveAttribute('class', /focus-visible/)
  await page.getByRole('button', { name: 'Pause updates', exact: true }).click()
  await expect(page.getByText('Display updates paused. Background recovery continues.')).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('recovery-desktop.png'), fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole('button', { name: 'Close menu', exact: true })).not.toBeInViewport()
  await expect(page.getByRole('heading', { name: 'Metadata recovery', exact: true })).toBeVisible()
  expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth)).toBe(true)
  expect(await page.locator('main').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('recovery-mobile.png'), fullPage: true })
  reject = true
  await page.getByRole('button', { name: 'Refresh cases', exact: true }).click()
  await expect(page.getByText(/Recovery data is unavailable/)).toBeVisible()
  await expect(page.getByText('Example movie 1', { exact: true })).toHaveCount(0)
  expect(writes).toBe(0)
})
