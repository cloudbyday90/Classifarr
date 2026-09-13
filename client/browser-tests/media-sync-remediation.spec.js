/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@playwright/test'
import { URL } from 'node:url'

test('an existing log gains a Plex link after recovery, with keyboard pause and private SWR', async ({ page }, testInfo) => {
  let online = false, reads = 0, writes = 0
  const errorId = 'bd65c13b-491d-4853-8803-2cc4b78ea8e1'
  const url = `https://app.plex.tv/desktop/#!/server/${'a'.repeat(40)}/details?key=%2Flibrary%2Fmetadata%2F123`
  const log = { error_id: errorId, module: 'mediaSync', level: 'WARN', message: 'Library sync skipped source items', created_at: '2026-09-13T12:00:00Z', resolved: false }
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const path = new URL(route.request().url()).pathname
    if (route.request().method() !== 'GET') writes++
    let data = {}
    if (path.endsWith('/setup/status') || path.endsWith('/setup-status')) data = { setupRequired: false }
    if (['/api/auth/me', '/api/user/me'].includes(path)) data = { id: 1, role: 'admin', username: 'test-operator' }
    if (path === '/api/notifications') data = { data: [] }
    if (path === '/api/notifications/unread-count') data = { unread: 0 }
    if (path === '/api/logs/stats') data = { totals: { total_logs: 1, unresolved_logs: 1 }, trends: { last24h: { logs_24h: 1 }, last7d: { logs_7d: 1 } } }
    if (path === '/api/logs') data = { logs: [log], pagination: { page: 1, limit: 50, total: 1, totalPages: 1 } }
    if (path === `/api/logs/error/${errorId}`) {
      reads++
      data = { ...log, remediation: { status: 'unresolved', explanation: 'Plex returned more than one catalog ID for this item.',
        scope: 'Current unresolved items associated with this warning.', recovery: 'Missing links are retried on refresh.',
        privacy: 'Review media titles and links before sharing.', steps: ['Open the item in Plex.', 'Choose More > Fix Match, or Refresh Metadata if the match is correct.', 'Classifarr sync retries recovery when due.'],
        items: [{ sourceId: '123', title: 'Fixture show', year: 2006, mediaType: 'TV show', library: 'Shows', issue: 'Conflicting TVDB IDs.', plexUrl: online ? url : null }] } }
    }
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Cache-Control': 'private, no-store' }, body: JSON.stringify(data) })
  })
  await page.goto('/settings?tab=logs')
  await page.getByRole('button', { name: 'View', exact: true }).click()
  const panel = page.getByRole('region', { name: 'How to resolve skipped Plex items' })
  await expect(panel).toContainText('Fixture show')
  await expect(panel).toContainText('Plex link is not available yet')
  await expect.poll(() => reads).toBeGreaterThanOrEqual(2)
  const pause = panel.getByRole('button', { name: 'Pause automatic updates' })
  await pause.focus(); await page.keyboard.press('Space')
  await expect(panel.getByRole('button', { name: 'Resume automatic updates' })).toBeFocused()
  const pausedReads = reads
  await page.clock.install()
  online = true
  await page.clock.runFor(31000)
  expect(reads).toBe(pausedReads)
  await panel.getByRole('button', { name: 'Resume automatic updates' }).press('Space')
  await page.clock.runFor(31000)
  const link = panel.getByRole('link', { name: 'Open Fixture show in Plex (new tab)' })
  await expect(link).toHaveAttribute('href', url)
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  expect(await page.evaluate(() => Object.keys(globalThis.localStorage).filter(key => key.includes('logs:remediation')))).toEqual([])
  await panel.screenshot({ path: testInfo.outputPath('plex-remediation-desktop.png') })
  await page.setViewportSize({ width: 390, height: 844 })
  await panel.screenshot({ path: testInfo.outputPath('plex-remediation-mobile.png') })
  const bounds = await panel.boundingBox()
  expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.x + bounds.width).toBeLessThanOrEqual(390)
  expect(await panel.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
  expect(writes).toBe(0)
})
