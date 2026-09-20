/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@playwright/test'
import { URL } from 'node:url'

// Isolated browser regression: all API traffic is intercepted, never real media.
test('library evidence uses SWR, supports keyboard pause, and stays compact on mobile', async ({ page }, testInfo) => {
  let reads = 0
  let writes = 0
  let held = 2
  let includeEvaluation = true
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const path = new URL(route.request().url()).pathname
    if (route.request().method() !== 'GET') writes++
    let data = {}
    if (path === '/api/setup/status') data = { setupRequired: false }
    if (['/api/auth/me', '/api/user/me'].includes(path)) data = { id: 1, role: 'admin', username: 'test-operator' }
    if (path === '/api/notifications') data = { data: [] }
    if (path === '/api/notifications/unread-count') data = { unread: 0 }
    if (['/api/libraries', '/api/classification/progress', '/api/queue/pending', '/api/queue/failed'].includes(path)) data = []
    if (path === '/api/queue/live-stats') {
      reads++
      data = { queue: { pending: 1 }, health: { ai: true, worker: true } }
      if (includeEvaluation) data.libraryEvaluation = {
        version: 'library_evaluation_summary_v1', status: 'available', routingAffected: false,
        counts: { prepared_admin_held: 20, strict_qualified_admin_held: held, calibrated_qualified_admin_held: 3,
          live_guard_blocked: 1, busy: 0, unavailable: 0, fallback_blocked: 1, freshness_blocked: 0, qualified: 4 },
        guardReasons: { comparison_not_supported: 0, identity_not_clear: 0, item_unusual: 1,
          familiarity_unavailable: 0, prompt_evidence_changed: 0 },
      }
    }
    if (path.includes('native-intent-reconciliation') || path.includes('held-out-semantic')) {
      await route.fulfill({ status: 403, contentType: 'application/json', body: '{}' })
      return
    }
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Cache-Control': 'no-store' }, body: JSON.stringify(data) })
  })
  await page.goto('/')
  const panel = page.getByRole('region', { name: 'Library learning' })
  await expect(panel).toContainText('9 checks passed')
  await expect(panel).toContainText('5 passing checks were held')
  const explanation = panel.getByText('Item descriptions were unusual for the suggested library')
  await expect(explanation).not.toBeVisible()
  const disclosure = panel.locator('summary')
  await disclosure.focus()
  await page.keyboard.press('Enter')
  await expect(panel.locator('details')).toHaveAttribute('open', '')
  await expect(explanation).toBeVisible()
  await expect(panel).toContainText('not additional failures')
  await expect(panel.getByRole('status')).not.toContainText('unusual')
  await panel.screenshot({ path: testInfo.outputPath('library-evaluation-reasons-desktop.png') })
  await page.keyboard.press('Enter')
  await expect(panel.locator('details')).not.toHaveAttribute('open')
  await panel.getByRole('button', { name: 'Pause summary' }).focus()
  await page.keyboard.press('Space')
  const priorReads = reads
  held = 3
  await expect.poll(() => reads, { timeout: 15_000 }).toBeGreaterThan(priorReads)
  await expect(panel).toContainText('9 checks passed')
  await expect(panel.getByRole('status')).toHaveText('Library evaluation summary paused.')
  await panel.getByRole('button', { name: 'Resume summary' }).press('Space')
  await expect(panel).toContainText('10 checks passed')
  expect(await page.evaluate(() => globalThis.localStorage.getItem('classifarr:v1:swr:command-center:live-stats'))).toBeNull()
  await panel.screenshot({ path: testInfo.outputPath('library-evaluation-desktop.png') })
  await page.setViewportSize({ width: 390, height: 844 })
  await expect.poll(() => page.locator('aside').evaluate(element => element.getBoundingClientRect().right)).toBeLessThanOrEqual(0)
  await panel.scrollIntoViewIfNeeded()
  await page.screenshot({ path: testInfo.outputPath('command-center-mobile.png'), animations: 'disabled' })
  const bounds = await panel.boundingBox()
  expect(bounds.x).toBeGreaterThanOrEqual(0)
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(390)
  expect(await panel.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
  await panel.screenshot({ path: testInfo.outputPath('library-evaluation-mobile.png'), animations: 'disabled' })
  await disclosure.press('Enter')
  await expect(explanation).toBeVisible()
  expect(await panel.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
  await panel.screenshot({ path: testInfo.outputPath('library-evaluation-reasons-mobile.png'), animations: 'disabled' })
  includeEvaluation = false
  await expect(panel).toHaveCount(0, { timeout: 15_000 })
  expect(writes).toBe(0)
})
