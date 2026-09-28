/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@playwright/test'

test('import progress becomes a retry wait without losing unsaved settings', async ({ page }, testInfo) => {
  let writes = 0
  let state = 'active'
  let sourceRecovery = null
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const path = new globalThis.URL(route.request().url()).pathname
    if (route.request().method() !== 'GET') writes++
    let data = {}
    if (path === '/api/setup/status') data = { setupRequired: false }
    if (path === '/api/auth/me' || path === '/api/user/me') data = { id: 1, role: 'admin', username: 'operator' }
    if (path === '/api/notifications') data = { data: [] }
    if (path === '/api/notifications/active') data = []
    if (path === '/api/notifications/unread-count') data = { unread: 0 }
    if (path === '/api/libraries/1') data = { id: 1, name: 'Synthetic library', media_type: 'movie', is_active: true,
      item_count: 25, priority: 1, ingestion_status: { state, sourceRecovery, pages: 2, items: 25, total: 100, retryAt: '2026-09-27T20:00:00Z' } }
    if (path === '/api/libraries/1/rules') data = []
    if (path === '/api/libraries/1/profile') data = { item_count: 0, rating_distribution: {}, genre_distribution: {}, studio_distribution: {} }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) })
  })
  await page.goto('/libraries/1')
  const section = page.getByRole('region', { name: 'Library import', exact: true })
  await expect(section.getByRole('progressbar')).toHaveAttribute('value', '25')
  await expect(section.getByRole('status')).toContainText('Importing library')
  const priority = page.getByLabel('Priority', { exact: true })
  await priority.fill('42')
  state = 'retry_wait'
  await expect(section.getByRole('status')).toContainText('Import retry scheduled', { timeout: 15000 })
  sourceRecovery = { state: 'open', reason: 'provider_unavailable', attempts: 1, retryAt: '2026-09-28T20:00:00Z' }
  await expect(section.getByRole('status')).toContainText('Waiting for media server', { timeout: 15000 })
  await expect(section.getByRole('status')).toContainText('Existing items are safe')
  await expect(priority).toHaveValue('42')
  await expect(section.getByRole('progressbar')).toHaveCount(0)
  await expect(section).toContainText('25 items processed · 2 pages')
  await page.setViewportSize({ width: 390, height: 844 })
  await section.scrollIntoViewIfNeeded()
  await expect.poll(() => page.locator('aside').evaluate(element => element.getBoundingClientRect().right)).toBeLessThanOrEqual(0)
  const bounds = await section.boundingBox()
  expect(bounds.x).toBeGreaterThanOrEqual(0)
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(390)
  expect(await section.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
  await section.screenshot({ path: testInfo.outputPath('import-retry-mobile.png') })
  sourceRecovery = null
  state = 'complete'
  await expect(section).toHaveCount(0, { timeout: 15000 })
  expect(writes).toBe(0)
})
