/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect } from '@playwright/test'

test('finds a lost recovery response after reload when the warning is gone, without another write', async ({ page }, testInfo) => {
  const writes = []
  let committed = false, requestId, historyReads = 0
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const request = route.request(), path = new globalThis.URL(request.url()).pathname
    if (request.method() !== 'GET') writes.push(path)
    let data = {}
    if (path === '/api/setup/status') data = { setupRequired: false }
    if (path === '/api/auth/me' || path === '/api/user/me') data = { id: 1, role: 'admin', username: 'operator' }
    if (path === '/api/notifications') data = { data: [] }
    if (path === '/api/notifications/active') data = []
    if (path === '/api/notifications/unread-count') data = { unread: 0 }
    if (path === '/api/libraries/1') data = { id: 1, name: 'Synthetic library', media_type: 'movie', is_active: true, item_count: 7, priority: 1,
      ingestion_status: { state: committed ? 'retry_wait' : 'legacy_owner_unknown', needsReconciliation: !committed } }
    if (path === '/api/libraries/1/ingestion-reconciliation') {
      if (request.method() === 'POST') {
        committed = true; requestId = request.postDataJSON().requestId
        await route.abort('failed'); return
      }
      data = { revision: '"synthetic-enabled-review"', reason: 'disable_library', canReconcile: false, canResume: true,
        syncs: [{ id: 8, status: 'running', processed: 5 }], capture: null }
    }
    if (path === '/api/libraries/1/ingestion-reconciliation/history') {
      historyReads++
      data = { limit: 20, hasMore: false, receipts: [{ auditId: 43, requestId, libraryId: 1,
        confirmedAt: '2026-09-30T12:00:00.000Z', status: 'reconciled', replay: 'scheduled' }] }
    }
    if (path === '/api/libraries/1/rules') data = []
    if (path === '/api/libraries/1/profile') data = { item_count: 0, rating_distribution: {}, genre_distribution: {}, studio_distribution: {} }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) })
  })
  await page.goto('/libraries/1')
  const review = page.getByRole('region', { name: 'Legacy import review' })
  await review.getByRole('button', { name: 'Review blocked import' }).click()
  await review.getByRole('checkbox').check()
  await review.getByRole('button', { name: 'Recover and resume import' }).click()
  await expect(review.getByRole('alert')).toContainText('outcome is unverified')
  expect(writes).toHaveLength(1)
  await page.reload()
  await expect(review).toHaveCount(0)
  expect(historyReads).toBe(0)
  const summary = page.locator('summary').filter({ hasText: 'Your recovery history' })
  await summary.focus(); await page.keyboard.press('Enter')
  const history = page.locator('details').filter({ has: summary })
  await expect(history.getByRole('status')).toContainText('Recorded recoveries: 1')
  await expect(history).toContainText(requestId)
  await expect(history).toContainText('Full import requested')
  await expect(history).toContainText('not a finished import')
  expect(historyReads).toBe(1)
  expect(writes).toHaveLength(1)
  await page.setViewportSize({ width: 390, height: 844 })
  await history.scrollIntoViewIfNeeded()
  await expect.poll(() => page.locator('aside').evaluate(element => element.getBoundingClientRect().right)).toBeLessThanOrEqual(0)
  expect(await history.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
  await history.screenshot({ path: testInfo.outputPath('recovery-history-mobile.png') })
})
