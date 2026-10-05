/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect } from '@playwright/test'
import { URL } from 'node:url'

for (const width of [390, 1280]) test(`synthetic migration diagnostics at ${width}px are read-only, keyboard accessible and downloadable`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 844 })
  let reads = 0, writes = 0
  const library = { id: 5, name: 'SYNTHETIC TEST — Migration failure', media_type: 'movie', is_active: true, rules: [],
    ingestion_status: { state: 'legacy_owner_unknown', recoveryMode: 'deployment_required' } }
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const path = new URL(route.request().url()).pathname
    if (route.request().method() !== 'GET') writes++
    let data = {}, status = 200
    if (path === '/api/setup/status') data = { setupRequired: false }
    if (['/api/auth/me', '/api/user/me'].includes(path)) data = { id: 1, role: 'admin', username: 'synthetic-operator' }
    if (path === '/api/libraries/5') data = library
    if (path === '/api/libraries') data = [library]
    if (path === '/api/notifications') data = { data: [] }
    if (path === '/api/notifications/unread-count') data = { unread: 0 }
    if (path.includes('/arr') || path.includes('/rules') || path.includes('/patterns')) data = []
    if (path.includes('native-intent-reconciliation') || path.includes('held-out-semantic')) status = 403
    if (path === '/api/libraries/migration-diagnostics') {
      reads++
      data = { status: 'available', ledgerStatus: 'not_recorded', guidance: 'Save this synthetic report for review. Do not rerun SQL manually.',
        report: { attemptId: 'SYNTHETIC-ATTEMPT', finishedAt: '2026-10-05T12:00:00Z', outcome: 'failed', omittedEvents: 0,
          limitations: 'Sanitized trace only. SQL and raw error text are omitted.', events: [{ step: 'migration_failed', errors: [{ code: 'P0001' }] }] } }
    }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) })
  })
  await page.goto('/libraries/5')
  const region = page.getByRole('region', { name: 'Migration diagnostics' })
  await expect(region).toBeVisible()
  expect(reads).toBe(0)
  const button = region.getByRole('button', { name: 'View migration diagnostics' })
  await button.focus(); await page.keyboard.press('Enter')
  await expect(region.getByRole('status')).toContainText('not recorded as applied')
  await expect(button).toBeFocused()
  await region.getByText('View recorded steps and error chain').focus(); await page.keyboard.press('Enter')
  await expect(region.getByLabel('Sanitized migration diagnostic JSON')).toContainText('P0001')
  const download = page.waitForEvent('download')
  await region.getByRole('link', { name: 'Download sanitized report' }).click()
  expect((await download).suggestedFilename()).toBe('classifarr-migration-diagnostic.json')
  expect(reads).toBe(1); expect(writes).toBe(0)
  if (width === 390) await expect.poll(() => page.locator('aside').evaluate(element => element.getBoundingClientRect().right)).toBeLessThanOrEqual(0)
  expect(await region.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
  await region.getByText('View recorded steps and error chain').focus(); await page.keyboard.press('Enter')
  await region.screenshot({ path: testInfo.outputPath('synthetic-migration-diagnostics.png') })
})
