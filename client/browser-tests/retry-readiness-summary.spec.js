/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@playwright/test'
import { URL } from 'node:url'

test('retry preview has visual counts, keyboard pause, no writes and no persistent cache', async ({ page }, testInfo) => {
  let reads = 0, writes = 0, unavailable = false
  const report = { version: 1, scope: 'web_search', limitPerQueue: 50, inspected: 50, hasMore: true,
    observedAt: new Date().toISOString(), earliestRetryAt: null,
    counts: { cached_ready: 8, provider_ready: 2, provider_wait: 10, settings_blocked: 25, scheduled: 4, held: 1 } }
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const path = new URL(route.request().url()).pathname
    if (route.request().method() !== 'GET') writes++
    let data = {}, status = 200
    if (path === '/api/setup/status') data = { setupRequired: false }
    if (['/api/auth/me', '/api/user/me'].includes(path)) data = { id: 1, role: 'admin', username: 'fixture' }
    if (path === '/api/notifications') data = { data: [] }
    if (path === '/api/notifications/unread-count') data = { unread: 0 }
    if (['/api/libraries', '/api/classification/progress', '/api/queue/pending', '/api/queue/failed'].includes(path)) data = []
    if (path === '/api/classification/pending') data = { items: [] }
    if (path === '/api/queue/live-stats') data = { queue: { pending: 0 }, health: { ai: true, worker: true } }
    if (path === '/api/reclassification/batches/activity') data = { batches: [], nextCursor: null }
    if (path === '/api/stats/evaluation-history') data = { version: 'evaluation_history_summary.v3', retentionDays: 30,
      windowLimit: 500, providerCalls: 0, routingWrites: 0, promotionAllowed: false,
      fullPipelineAccuracy: null, windows: 0, revisions: 0, groups: [] }
    if (path === '/api/queue/retry-readiness') {
      reads++; data = report; status = unavailable ? 503 : 200
    }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) })
  })
  await page.goto('/')
  const panel = page.getByRole('region', { name: 'Web-search retries' })
  await expect(panel.locator('.ready-count strong')).toHaveText('10')
  await expect(panel).toContainText('of 50 checked ready')
  await expect(panel).toContainText('Partial view')
  await expect(panel.locator('dl dd')).toHaveCount(6)
  await expect(panel.getByRole('link')).toHaveAttribute('href', '/settings?tab=web-search')
  await panel.screenshot({ path: testInfo.outputPath('retry-readiness-desktop.png') })
  const pause = panel.getByRole('button', { name: 'Pause updates' })
  await pause.focus(); await page.keyboard.press('Enter')
  await expect(panel.getByRole('button', { name: 'Resume updates' })).toBeFocused()
  await expect(panel).toContainText('background retries are unchanged')
  expect(reads).toBe(1)
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 })
    // Let the existing responsive navigation finish its slide-out transition.
    await expect.poll(() => page.locator('aside').evaluate(element => element.getBoundingClientRect().right)).toBeLessThanOrEqual(0)
    expect(await panel.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
    await expect(panel.getByRole('button', { name: 'Resume updates' })).toBeInViewport()
  }
  await panel.screenshot({ path: testInfo.outputPath('retry-readiness-mobile.png') })
  unavailable = true
  await page.keyboard.press('Enter')
  await expect(panel.getByRole('status')).toHaveText('Status unavailable')
  await expect(panel.locator('dl')).toHaveCount(0)
  await expect(panel.getByRole('link')).toHaveCount(0)
  expect(await page.evaluate(() => globalThis.localStorage.getItem('classifarr:v1:swr:command-center:retry-readiness'))).toBeNull()
  expect(writes).toBe(0)
})
