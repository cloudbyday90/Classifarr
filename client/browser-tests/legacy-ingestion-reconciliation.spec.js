/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect } from '@playwright/test'

test('review, disable, confirm and retain an audit receipt without automatic enabling', async ({ page }, testInfo) => {
  let enabled = true, reconciled = false
  const writes = []
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const request = route.request(), path = new globalThis.URL(request.url()).pathname
    let data = {}
    if (request.method() !== 'GET') writes.push({ path, body: request.postDataJSON(), revision: request.headers()['if-match'] })
    if (path === '/api/setup/status') data = { setupRequired: false }
    if (path === '/api/auth/me' || path === '/api/user/me') data = { id: 1, role: 'admin', username: 'operator' }
    if (path === '/api/notifications') data = { data: [] }
    if (path === '/api/notifications/active') data = []
    if (path === '/api/notifications/unread-count') data = { unread: 0 }
    if (path === '/api/libraries/1') {
      if (request.method() === 'PUT') enabled = request.postDataJSON().is_active
      data = { id: 1, name: 'Synthetic library', media_type: 'movie', is_active: enabled, item_count: 7, priority: 1,
        ingestion_status: { state: reconciled ? 'disabled' : 'legacy_owner_unknown', needsReconciliation: !reconciled } }
    }
    if (path === '/api/libraries/1/ingestion-reconciliation') {
      if (request.method() === 'POST') {
        expect(enabled).toBe(false); reconciled = true
        data = { receipt: { auditId: 42 } }
      } else data = { revision: '"synthetic-revision"', reason: enabled ? 'disable_library' : 'confirmation_required',
        canReconcile: !enabled, syncs: [{ id: 7, status: 'running', processed: 5 }], capture: { generation: 2, source: 'media_sync' } }
    }
    if (path === '/api/libraries/1/rules') data = []
    if (path === '/api/libraries/1/profile') data = { item_count: 0, rating_distribution: {}, genre_distribution: {}, studio_distribution: {} }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) })
  })
  await page.goto('/libraries/1')
  const review = page.getByRole('region', { name: 'Legacy import review' })
  await review.getByRole('button', { name: 'Review blocked import' }).click()
  await expect(review).toContainText('Turn off “Library enabled” above and save')
  await expect(review.getByRole('checkbox')).toHaveCount(0)
  await page.getByLabel('Library enabled', { exact: true }).uncheck()
  await page.getByRole('button', { name: 'Save Changes', exact: true }).click()
  await expect.poll(() => enabled).toBe(false)
  await review.getByRole('button', { name: 'Refresh review' }).click()
  await review.getByRole('checkbox').check()
  await review.getByRole('button', { name: 'Reconcile reviewed records' }).click()
  await expect(review.getByRole('status')).toContainText('receipt #42')
  await expect(page.getByLabel('Library enabled', { exact: true })).not.toBeChecked()
  expect(writes).toHaveLength(2)
  expect(writes[1]).toMatchObject({ revision: '"synthetic-revision"', body: { workersStopped: true } })
  await page.setViewportSize({ width: 390, height: 844 })
  await review.scrollIntoViewIfNeeded()
  expect(await review.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
  await review.screenshot({ path: testInfo.outputPath('legacy-reconciliation-mobile.png') })
})
