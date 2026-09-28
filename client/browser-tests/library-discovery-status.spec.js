/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@playwright/test'

test('Jellyfin discovery guidance is keyboard accessible, read-only to refresh, and updates after explicit sync', async ({ page }, testInfo) => {
  let reason = 'forbidden', reads = 0
  const writes = [], errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const path = new globalThis.URL(route.request().url()).pathname
    if (route.request().method() !== 'GET') writes.push(path)
    let data = {}
    if (path === '/api/setup/status') data = { setupRequired: false }
    if (path === '/api/auth/me' || path === '/api/user/me') data = { id: 1, role: 'admin', username: 'operator' }
    if (path === '/api/notifications') data = { data: [] }
    if (path === '/api/notifications/active') data = []
    if (path === '/api/notifications/unread-count') data = { unread: 0 }
    if (path === '/api/media-server') data = { type: 'jellyfin', name: 'Synthetic Jellyfin', url: 'http://synthetic.invalid', api_key: '' }
    if (path === '/api/media-server/sync') { reason = 'complete'; data = { success: true, libraries: [] } }
    if (path === '/api/media-server/discovery-status') {
      reads++
      data = { provider: 'jellyfin', reason, title: reason === 'complete' ? 'Library discovery complete' : 'Library access was denied',
        nextStep: reason === 'complete' ? 'Review your libraries; content ingestion and backfill have separate progress.' : 'Check the saved account or API key has library access, then sync again.',
        lastSuccessAt: '2026-09-27T12:00:00.000Z', lastSuccessCount: 2, attemptedAt: '2026-09-27T13:00:00.000Z',
        contract: 'jellyfin_virtual_folders', httpStatus: reason === 'complete' ? null : 403 }
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) })
  })
  await page.goto('/settings?tab=mediaserver')
  const section = page.getByRole('region', { name: 'Library discovery status', exact: true })
  await expect(section.getByRole('status')).toContainText('Library access was denied')
  await expect(section).toContainText('Jellyfin')
  await section.getByRole('button', { name: 'Refresh status', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect.poll(() => reads).toBe(2)
  await page.keyboard.press('Tab')
  await expect(section.locator('summary')).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(section.locator('details')).toHaveAttribute('open', '')
  await expect(section.locator('details')).toContainText('Jellyfin virtual folders. HTTP 403')
  expect(writes).toEqual([])
  await section.screenshot({ path: testInfo.outputPath('discovery-desktop.png') })
  await page.setViewportSize({ width: 390, height: 844 })
  await section.scrollIntoViewIfNeeded()
  // Wait for the existing responsive drawer transition before judging overlap.
  await expect.poll(async () => page.locator('aside').evaluate(element => element.getBoundingClientRect().right)).toBeLessThanOrEqual(0)
  expect(await section.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
  await section.screenshot({ path: testInfo.outputPath('discovery-mobile.png') })
  await section.getByRole('button', { name: 'Sync Libraries', exact: true }).click()
  await expect(section.getByRole('status')).toContainText('Library discovery complete')
  expect(writes).toEqual(['/api/media-server/sync', '/api/media-server/ingest'])
  expect(reads).toBe(3)
  expect(errors).toEqual([])
})
