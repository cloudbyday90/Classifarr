/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@playwright/test'
import { URL } from 'node:url'

for (const reload of [false, true]) {
  test(`recovers a lost confirmation response ${reload ? 'after reloading the page' : 'with a keyboard receipt check'}`, async ({ page }, testInfo) => {
    let confirmations = 0
    let receiptReads = 0
    let visibleCommit = false
    let previews = 0
    const previewId = '2e851bf4-9497-4b99-8b7c-e8117a05c762'
    const source = { id: 1, title: 'A Quiet Place', year: 2018, mediaType: 'movie', libraryName: 'Movies', reason: 'conflicting_external_ids', sourceVersion: 'a'.repeat(64) }
    await page.route(url => url.pathname.startsWith('/api/'), async route => {
      const path = new URL(route.request().url()).pathname
      let data = {}
      if (path === '/api/setup/status') data = { setupRequired: false }
      if (path === '/api/auth/me' || path === '/api/user/me') data = { id: 1, role: 'admin', username: 'reviewer' }
      if (path === '/api/notifications') data = { data: [] }
      if (path === '/api/notifications/unread-count') data = { unread: 0 }
      if (path === '/api/media-identity-review') data = { items: confirmations ? [] : [source], nextCursor: null }
      if (path.endsWith('/1/preview')) {
        previews++
        data = { previewId, source, expiresAt: new Date(Date.now() + 600000).toISOString(), candidate: { tmdbId: 447332, mediaType: 'movie', title: 'A Quiet Place', releaseDate: '2018-04-03' } }
      }
      if (path.endsWith('/1/confirm')) {
        confirmations++
        expect(route.request().postDataJSON()).toEqual({ previewId, confirmed: true })
        // The write was accepted, but its response never reaches the browser.
        await route.abort('failed')
        return
      }
      if (path.endsWith(`/1/receipts/${previewId}`)) {
        expect(route.request().method()).toBe('GET')
        receiptReads++
        data = visibleCommit
          ? { version: 1, status: 'confirmed', receipt: { auditId: 42, previewId, itemId: 1, tmdbId: 447332, mediaType: 'movie', sourceVersion: source.sourceVersion, confirmedAt: '2026-08-01T12:00:00.000Z' } }
          : { version: 1, status: 'not_observed', receipt: null }
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) })
    })
    await page.goto('/libraries/identity-review')
    await page.getByRole('button', { name: 'Review A Quiet Place', exact: true }).click()
    await page.getByLabel('TMDb movie ID', { exact: true }).fill('447332')
    await page.getByRole('button', { name: 'Preview identity', exact: true }).click()
    await page.getByRole('checkbox').check()
    await page.getByRole('button', { name: 'Confirm identity', exact: true }).click()
    await expect(page.getByRole('status').filter({ hasText: 'No verified receipt is visible yet' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Confirm identity', exact: true })).toHaveCount(0)
    expect(confirmations).toBe(1)
    expect(receiptReads).toBe(1)
    visibleCommit = true
    if (reload) await page.reload()
    else {
      await page.getByRole('button', { name: 'Check receipt again' }).focus()
      await page.keyboard.press('Enter')
    }
    const recovered = page.getByRole('region', { name: 'Confirmation receipt' })
    await expect(recovered).toContainText('TMDb movie 447332')
    await expect(recovered.getByRole('status')).toContainText('inventory may have changed')
    expect(confirmations).toBe(1)
    expect(previews).toBe(1)
    expect(receiptReads).toBe(2)
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(page.getByRole('button', { name: 'Close menu' })).not.toBeInViewport()
    await recovered.screenshot({ path: testInfo.outputPath('identity-recovery-mobile.png') })
    expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth)).toBe(true)
    await page.getByRole('button', { name: 'Return to review queue', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Review media IDs', exact: true })).toBeFocused()
    await expect(page.getByText('No items currently need identity review for this filter.')).toBeVisible()
  })
}
