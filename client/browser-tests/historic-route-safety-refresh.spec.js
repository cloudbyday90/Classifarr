/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@playwright/test'
import { URL } from 'node:url'

test('historic refresh keeps adjacent History IDs separate across pages and in the receipt', async ({ page }) => {
  const first = '9223372036854775806', last = '9223372036854775807'
  const receiptId = '6c5a0839-0ae0-44a7-b3c4-18f413b58b13'
  const base = '/api/classification/pending/route-safety-refresh'
  let posts = 0
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const { pathname, searchParams } = new URL(route.request().url())
    let data = {}
    if (pathname === '/api/setup/status') data = { setupRequired: false }
    if (['/api/auth/me', '/api/user/me'].includes(pathname)) data = { id: 1, role: 'admin', username: 'fixture-operator' }
    if (pathname === '/api/notifications') data = { data: [] }
    if (pathname === `${base}-inventory`) {
      const cursor = searchParams.get('cursor')
      expect([null, first]).toContain(cursor)
      const classificationId = cursor ? last : first
      data = {
        mode: 'read_only', validation: { ok: true },
        records: [{ classificationId, candidateItem: { title: cursor ? 'Last historic row' : 'First historic row' } }],
        pagination: { hasNextPage: cursor === null, nextCursor: cursor ? null : first },
        operatorRetryPlan: { maximumClassificationIds: 50 },
      }
    }
    if (pathname === `${base}/retry`) {
      expect(route.request().method()).toBe('POST')
      expect(route.request().postDataJSON()).toEqual({ classificationIds: [first, last] })
      posts++
      data = { retryReceipt: receiptId }
    }
    if (pathname === `${base}/receipts/recent`) data = { mode: 'read_only', recentReceipt: null }
    if (pathname === `${base}/receipts/${receiptId}`) {
      expect(route.request().method()).toBe('GET')
      data = {
        mode: 'read_only', receipt: { retryReceipt: receiptId, executionStatusId: 'finalized' },
        summary: { queued: 1, skipped: 1, runtimeFinal: 1 },
        records: [
          { classificationId: first, executionStatusId: 'skipped', reconciliationStatusId: 'not_queued' },
          { classificationId: last, executionStatusId: 'queued', reconciliationStatusId: 'runtime_completed' },
        ],
      }
    }
    await route.fulfill({ json: data })
  })

  await page.goto('/policies/historic-route-safety-refresh')
  await page.getByRole('checkbox', { name: 'Select First historic row' }).check()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await page.getByRole('checkbox', { name: 'Select Last historic row' }).check()
  const retry = page.getByRole('button', { name: 'Retry 2 selected records' })
  await expect(retry).toBeDisabled()
  await page.getByRole('checkbox', { name: /I reviewed the selected records/ }).check()
  await retry.click()
  await expect(page.getByText(first, { exact: true })).toBeVisible()
  await expect(page.getByText(last, { exact: true })).toBeVisible()
  expect(posts).toBe(1)
})
