/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@playwright/test'
import { URL } from 'node:url'

test('saved evaluation coverage is compact, keyboard-pausable and clears after lost access', async ({ page }, testInfo) => {
  let paired = 20, denied = false, reads = 0, writes = 0
  await page.clock.install()
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const path = new URL(route.request().url()).pathname
    if (route.request().method() !== 'GET') writes++
    let data = {}, status = 200
    if (path === '/api/setup/status') data = { setupRequired: false }
    if (['/api/auth/me', '/api/user/me'].includes(path)) data = { id: 1, role: 'admin', username: 'synthetic-operator' }
    if (path === '/api/notifications') data = { data: [] }
    if (path === '/api/notifications/unread-count') data = { unread: 0 }
    if (path === '/api/reclassification/batches/activity') data = { batches: [], nextCursor: null }
    if (['/api/libraries', '/api/classification/progress', '/api/queue/pending', '/api/queue/failed'].includes(path)) data = []
    if (path === '/api/queue/live-stats') data = { queue: { pending: 0 }, health: { ai: true, worker: true } }
    if (path.includes('native-intent-reconciliation') || path.includes('held-out-semantic')) status = 403
    if (path === '/api/stats/evaluation-history') {
      reads++
      if (denied) status = 403
      else data = { version: 'evaluation_history_summary.v1', retentionDays: 30, windowLimit: 500, windows: 3, revisions: 1,
        groups: [{ latestAt: '2026-09-25T12:00:00Z', windows: 3, sampled: 300, eligible: 120, selected: 50, paired,
          labeled: 5, gains: 2, regressions: 1, deferralsReduced: 4, deferralsIncreased: 1, moviePaired: paired - 10, tvPaired: 10 }],
        providerCalls: 0, routingWrites: 0, promotionAllowed: false, fullPipelineAccuracy: null }
    }
    await route.fulfill({ status, contentType: 'application/json', headers: { 'Cache-Control': 'no-store' }, body: JSON.stringify(data) })
  })
  await page.goto('/')
  const panel = page.getByRole('region', { name: 'Evaluation progress' })
  await expect(panel).toContainText('20 of 120 eligible items compared')
  await expect(panel.locator('details')).not.toHaveAttribute('open')
  await panel.screenshot({ path: testInfo.outputPath('evaluation-history-desktop.png') })
  await panel.getByRole('button', { name: 'Pause summary' }).focus()
  await page.keyboard.press('Space')
  paired = 25
  await page.clock.runFor(300_000)
  await expect.poll(() => reads).toBeGreaterThan(1)
  await expect(panel).toContainText('20 of 120')
  await panel.getByRole('button', { name: 'Resume summary' }).press('Space')
  await expect(panel).toContainText('25 of 120')
  const disclosure = panel.locator('summary')
  await disclosure.focus(); await page.keyboard.press('Enter')
  await expect(panel.locator('details')).toHaveAttribute('open', '')
  await expect(panel).toContainText('historical results, not live model verification')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.clock.runFor(1000)
  await expect.poll(() => page.locator('aside').evaluate(element => element.getBoundingClientRect().right)).toBeLessThanOrEqual(0)
  await panel.scrollIntoViewIfNeeded()
  expect(await panel.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
  const bounds = await panel.boundingBox()
  expect(bounds.x).toBeGreaterThanOrEqual(0)
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(390)
  await panel.screenshot({ path: testInfo.outputPath('evaluation-history-mobile.png') })
  expect(await page.evaluate(() => globalThis.localStorage.getItem('classifarr:v1:swr:evaluation-history'))).toBeNull()
  await panel.getByRole('button', { name: 'Pause summary' }).press('Space')
  denied = true
  await page.clock.runFor(300_000)
  await expect(panel).toHaveCount(0)
  expect(writes).toBe(0)
})
