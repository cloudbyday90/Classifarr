/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect } from '@playwright/test'

async function captureMobileReview(page, review, testInfo, filename) {
  await page.setViewportSize({ width: 390, height: 844 })
  await review.scrollIntoViewIfNeeded()
  await expect.poll(() => page.locator('aside').evaluate(element => element.getBoundingClientRect().right)).toBeLessThanOrEqual(0)
  const bounds = await review.boundingBox()
  expect(bounds.x).toBeGreaterThanOrEqual(0)
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(390)
  expect(await review.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
  await review.screenshot({ path: testInfo.outputPath(filename) })
}

test('older preview contract retains disable, confirm and audit without automatic enabling', async ({ page }, testInfo) => {
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
  await captureMobileReview(page, review, testInfo, 'legacy-reconciliation-mobile.png')
})

test('enabled recovery uses keyboard confirmation and schedules a handoff without settings writes', async ({ page }, testInfo) => {
  const writes = []
  let reconciled = false
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const request = route.request(), path = new globalThis.URL(request.url()).pathname
    if (request.method() !== 'GET') writes.push({ path, body: request.postDataJSON(), revision: request.headers()['if-match'] })
    let data = {}
    if (path === '/api/setup/status') data = { setupRequired: false }
    if (path === '/api/auth/me' || path === '/api/user/me') data = { id: 1, role: 'admin', username: 'operator' }
    if (path === '/api/notifications') data = { data: [] }
    if (path === '/api/notifications/active') data = []
    if (path === '/api/notifications/unread-count') data = { unread: 0 }
    if (path === '/api/libraries/1') data = { id: 1, name: 'Synthetic library', media_type: 'tv', is_active: true, item_count: 7, priority: 1,
      ingestion_status: { state: reconciled ? 'retry_wait' : 'legacy_owner_unknown', needsReconciliation: !reconciled } }
    if (path === '/api/libraries/1/ingestion-reconciliation') {
      if (request.method() === 'POST') {
        reconciled = true
        data = { receipt: { auditId: 43, replay: 'scheduled' } }
      } else data = { revision: '"synthetic-enabled-review"', reason: 'disable_library', resumeReason: 'confirmation_required',
        canReconcile: false, canResume: true, syncs: [{ id: 8, status: 'running', processed: 5 }], capture: null }
    }
    if (path === '/api/libraries/1/rules') data = []
    if (path === '/api/libraries/1/profile') data = { item_count: 0, rating_distribution: {}, genre_distribution: {}, studio_distribution: {} }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) })
  })
  await page.goto('/libraries/1')
  const review = page.getByRole('region', { name: 'Legacy import review' })
  await expect(page.getByRole('region', { name: 'Library import', exact: true })).toContainText('Interrupted import needs review')
  await review.getByRole('button', { name: 'Review blocked import' }).click()
  const submit = review.getByRole('button', { name: 'Recover and resume import' })
  await expect(submit).toBeDisabled()
  expect(writes).toHaveLength(0)
  await review.getByRole('checkbox', { name: /I verified that older instances/ }).focus()
  await page.keyboard.press('Space')
  await page.keyboard.press('Tab')
  await expect(submit).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(review.getByRole('status')).toContainText('receipt #43')
  await expect(review.getByRole('status')).toContainText('does not mean the import has finished')
  await expect(page.getByLabel('Library enabled', { exact: true })).toBeChecked()
  expect(writes).toHaveLength(1)
  expect(writes[0]).toMatchObject({ path: '/api/libraries/1/ingestion-reconciliation',
    revision: '"synthetic-enabled-review"', body: { workersStopped: true, resume: true, requestId: expect.any(String) } })
  await captureMobileReview(page, review, testInfo, 'legacy-resume-mobile.png')
})
