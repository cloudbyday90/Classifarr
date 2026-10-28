/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect } from '@playwright/test'
import { feedbackReviewFixture, feedbackCommandFixture, feedbackReceiptFixture } from '../src/__tests__/fixtures/feedbackReviewFixture.js'

for (const lost of [false, true]) {
  test(`History feedback has a labeled explicit choice and recovers ${lost ? 'a lost response' : 'a direct receipt'} without a second vote`, async ({ page }, testInfo) => {
    const writes = [], reads = []
    let committed = false
    await page.route(url => url.pathname.startsWith('/api/'), async route => {
      const request = route.request(), path = new globalThis.URL(request.url()).pathname
      let data = {}
      if (request.method() !== 'GET') writes.push({ path, body: request.postDataJSON() })
      else reads.push(path)
      if (path === '/api/setup/status') data = { setupRequired: false }
      if (path === '/api/auth/me' || path === '/api/user/me') data = { id: 1, role: 'admin', username: 'reviewer' }
      if (path === '/api/notifications' || path === '/api/notifications/active') data = []
      if (path === '/api/notifications/unread-count') data = { unread: 0 }
      if (path === '/api/libraries') data = []
      if (path === '/api/classification/history') data = { data: [{ id: '7', title: 'Synthetic review', year: 2026, tmdb_id: 603,
        media_type: 'movie', status: 'completed', method: 'policy_auto', confidence: 75, library_name: 'Current outcome', created_at: '2026-10-28T12:00:00.000Z' }], pagination: { page: 1, totalPages: 1, total: 1 } }
      if (path === '/api/feedback/7/review') data = feedbackReviewFixture()
      if (path === '/api/feedback/7/review/submit') {
        expect(request.postDataJSON()).toEqual(feedbackCommandFixture()); committed = true
        if (lost) { await route.abort('failed'); return }
        data = { classificationId: '7', reviewId: feedbackCommandFixture().reviewId, feedbackId: 9, replayed: false }
      }
      if (path.endsWith('/receipt')) { expect(committed).toBe(true); data = feedbackReceiptFixture() }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) })
    })
    async function openFromHistory() {
      await page.getByRole('button', { name: 'View details for Synthetic review', exact: true }).focus()
      await page.keyboard.press('Enter')
      const opener = page.getByRole('button', { name: 'Review library feedback', exact: true })
      await opener.focus(); await page.keyboard.press('Enter')
      return opener
    }
    await page.goto('/history'); const opener = await openFromHistory()
    const dialog = page.getByRole('dialog', { name: 'Review library feedback', exact: true })
    await expect(dialog.getByRole('heading', { name: 'Review library feedback', exact: true })).toBeFocused()
    await expect(dialog).toContainText('Original automated destination: Original destination')
    await expect(dialog).toContainText('Current recorded outcome: Current outcome')
    const submit = dialog.getByRole('button', { name: 'Confirm original destination as feedback', exact: true })
    await expect(submit).toBeDisabled()
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(dialog.getByLabel('Policy for feedback confirming the original destination', { exact: true })).toBeInViewport()
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
    await dialog.screenshot({ path: testInfo.outputPath('feedback-prepared-mobile.png') })
    await page.setViewportSize({ width: 1280, height: 720 })
    await dialog.getByLabel('Policy for feedback confirming the original destination', { exact: true }).selectOption('11')
    await submit.focus(); await page.keyboard.press('Enter')
    if (lost) {
      await expect(dialog.getByRole('status')).toContainText('unverified')
      await expect(dialog.getByRole('button', { name: 'Prepare a new review', exact: true })).toHaveCount(0)
      await page.reload(); await openFromHistory()
      await expect(dialog.getByRole('status')).toContainText('Feedback was recorded')
      expect(reads.filter(path => path.endsWith('/receipt'))).toHaveLength(1)
    } else await expect(dialog.getByRole('status')).toContainText('Feedback was recorded')
    await page.setViewportSize({ width: 390, height: 844 })
    expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`feedback-${lost ? 'recovered' : 'recorded'}.png`), fullPage: true })
    await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0)
    await expect(lost ? page.getByRole('button', { name: 'Review library feedback', exact: true }) : opener).toBeFocused()
    expect(writes).toEqual([{ path: '/api/feedback/7/review', body: {} }, { path: '/api/feedback/7/review/submit', body: feedbackCommandFixture() }])
  })
}
