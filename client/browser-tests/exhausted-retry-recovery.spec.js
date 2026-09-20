/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@playwright/test'

test('History offers keyboard recovery only for exhausted failures and announces enqueue', async ({ page }, testInfo) => {
  let retries = 0
  let historyReads = 0
  const row = {
    id: 71, title: 'Synthetic recovery movie', year: 2026, media_type: 'movie',
    library_id: null, library_name: null, status: 'failed', method: 'queued_for_retry',
    confidence: 0, retry_count: 3, max_retries: 3, retry_after: null,
    created_at: '2026-09-20T12:00:00Z', metadata: {},
    retry_recovery: { eligible: true, reasonCode: 'retry_exhausted' },
  }
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const path = new globalThis.URL(route.request().url()).pathname
    let data = {}
    if (path === '/api/setup/status') data = { setupRequired: false }
    if (path === '/api/auth/me' || path === '/api/user/me') data = { id: 1, role: 'admin', username: 'operator' }
    if (path === '/api/notifications') data = { data: [] }
    if (path === '/api/notifications/active') data = []
    if (path === '/api/notifications/unread-count') data = { unread: 0 }
    if (path === '/api/libraries') data = []
    if (path === '/api/classification/history') {
      historyReads++
      data = { data: [row], pagination: { page: 1, total: 1, totalPages: 1 } }
    }
    if (route.request().method() !== 'GET') {
      expect(path).toBe('/api/classification/retry')
      expect(route.request().postDataJSON()).toEqual({ classificationIds: [71], options: {} })
      retries++
      row.status = 'reclassified'
      row.retry_recovery = null
      data = { success: true, queued: 1, results: [{ classificationId: 71, queued: true, taskId: 72 }] }
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) })
  })
  await page.goto('/history')
  await page.getByText(row.title, { exact: true }).click()
  const region = page.getByRole('region', { name: 'Classification retry recovery' })
  const button = region.getByRole('button', { name: 'Retry Classification', exact: true })
  await expect(region.getByText('Automatic retries stopped', { exact: true })).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  await button.focus()
  await expect(button).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(region.getByRole('status')).toHaveText('Classification retry queued. Follow its progress in the Command Center.')
  await expect(button).toBeDisabled()
  expect(retries).toBe(1)
  await expect.poll(() => historyReads).toBe(2)
  expect(await region.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
  await region.screenshot({ path: testInfo.outputPath('exhausted-retry-mobile.png') })
  await page.getByRole('button', { name: 'Close', exact: true }).click()
  await page.getByText(row.title, { exact: true }).click()
  await expect(region).toHaveCount(0)
  expect(retries).toBe(1)
})
