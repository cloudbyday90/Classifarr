/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@playwright/test'
import { URL } from 'node:url'

test('recovery banner is read-only, responsive, keyboard accessible and clears stale guidance', async ({ page }, testInfo) => {
  let writes = 0, reads = 0, denied = false
  let libraries = [
    { id: 5, name: 'Movies', media_type: 'movie', is_active: true,
      ingestion_status: { state: 'legacy_owner_unknown', recoveryMode: 'deployment_required', recoveryDiagnostic: {
        migration: '20261005_180000_ingestion_compatibility_fence.sql', migrationRecorded: true, protocolReady: true,
        checks: [{ table: 'media_server_items', trigger: 'ingestion_compatibility_rows', status: 'not_always_enabled' }],
      } } },
    { id: 6, name: 'Family', media_type: 'tv', is_active: true,
      ingestion_status: { state: 'legacy_owner_unknown', recoveryMode: 'automatic' } },
  ]
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const path = new URL(route.request().url()).pathname
    if (route.request().method() !== 'GET') writes++
    let data = {}, status = 200
    if (path === '/api/setup/status') data = { setupRequired: false }
    if (['/api/auth/me', '/api/user/me'].includes(path)) data = { id: 1, role: 'admin', username: 'fixture-operator' }
    if (path === '/api/notifications') data = { data: [] }
    if (path === '/api/notifications/unread-count') data = { unread: 0 }
    if (['/api/classification/progress', '/api/queue/pending', '/api/queue/failed'].includes(path)) data = []
    if (path === '/api/libraries') { reads++; data = libraries; if (denied) status = 403 }
    if (path === '/api/queue/live-stats') data = { queue: { pending: 0 }, health: { ai: true, worker: true } }
    if (path === '/api/classification/pending') data = { items: [] }
    if (path === '/api/reclassification/batches/activity') data = { batches: [], nextCursor: null }
    if (path.includes('native-intent-reconciliation') || path.includes('held-out-semantic')) status = 403
    await route.fulfill({ status, contentType: 'application/json', headers: { 'Cache-Control': 'no-store' }, body: JSON.stringify(data) })
  })
  await page.goto('/')
  const banner = page.getByRole('region', { name: '1 library needs attention' })
  await expect(banner).toBeVisible()
  await expect(banner).toContainText('Automatic recovery queued')
  await expect(banner.getByRole('link', { name: /Open library\s*:\s*Movies/ })).toHaveAttribute('href', '/libraries/5')
  await expect(banner.getByRole('link', { name: /View import\s*:\s*Family/ })).toHaveAttribute('href', '/libraries/6')
  await expect(banner.locator('.deployment-guidance details p').first()).not.toBeVisible()
  await banner.getByText('What Classifarr checked', { exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(banner).toContainText('media_server_items / ingestion_compatibility_rows: not enabled for all writes')
  await banner.screenshot({ path: testInfo.outputPath('recovery-desktop.png') })
  await page.keyboard.press('Enter')
  await expect(banner.locator('.deployment-guidance details p').first()).not.toBeVisible()
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 })
    await expect.poll(() => page.locator('aside').evaluate(element => element.getBoundingClientRect().right)).toBeLessThanOrEqual(0)
    expect(await banner.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
  }
  await banner.screenshot({ path: testInfo.outputPath('recovery-mobile.png') })
  const refresh = banner.getByRole('button', { name: 'Refresh status' })
  await refresh.focus()
  await page.keyboard.press('Enter')
  await expect.poll(() => reads).toBeGreaterThan(1)
  await expect(refresh).toBeFocused()
  denied = true
  await refresh.click()
  const unavailable = page.getByRole('region', { name: 'Library status unavailable' })
  await expect(unavailable).toBeVisible()
  await expect(unavailable.getByRole('link')).toHaveCount(0)
  await expect(unavailable).not.toContainText('Movies')
  denied = false
  libraries = []
  await unavailable.getByRole('button', { name: 'Refresh status' }).click()
  await expect(page.locator('.recovery-banner')).toHaveCount(0)
  await expect(page.getByRole('status').filter({ hasText: 'No library import issues reported.' })).toHaveCount(1)
  await expect(page.getByRole('status').filter({ hasText: 'No library import issues reported.' })).toBeFocused()
  expect(await page.evaluate(() => globalThis.localStorage.getItem('classifarr:v1:swr:command-center:libraries'))).toBeNull()
  expect(writes).toBe(0)
})
