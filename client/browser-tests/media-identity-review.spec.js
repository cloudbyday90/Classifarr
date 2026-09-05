/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@playwright/test'
import { URL } from 'node:url'

test('keyboard review requires explicit confirmation and announces the audit receipt', async ({ page }, testInfo) => {
  let saved = false
  const source = { id: 1, title: 'A Quiet Place', year: 2018, mediaType: 'movie', libraryName: 'Movies', reason: 'conflicting_external_ids', sourceVersion: 'a'.repeat(64), imdbId: 'tt6644200' }
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const path = new URL(route.request().url()).pathname
    let data = {}
    if (path === '/api/setup/status') data = { setupRequired: false }
    if (path === '/api/auth/me' || path === '/api/user/me') data = { id: 1, role: 'admin', username: 'reviewer' }
    if (path === '/api/notifications') data = { data: [] }
    if (path === '/api/notifications/unread-count') data = { unread: 0 }
    if (path === '/api/media-identity-review') data = { items: saved ? [] : [source], nextCursor: null }
    if (path.endsWith('/1/preview')) data = {
      previewId: '2e851bf4-9497-4b99-8b7c-e8117a05c762', source, expiresAt: new Date(Date.now() + 600000).toISOString(),
      candidate: { tmdbId: 447332, mediaType: 'movie', title: 'A Quiet Place', releaseDate: '2018-04-03', overview: 'A family lives in silence to avoid creatures that hunt by sound.' },
    }
    if (path.endsWith('/1/confirm')) {
      expect(route.request().postDataJSON()).toEqual({ previewId: '2e851bf4-9497-4b99-8b7c-e8117a05c762', confirmed: true })
      saved = true
      data = { auditId: 42 }
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) })
  })
  await page.goto('/libraries/identity-review')
  const review = page.getByRole('button', { name: 'Review A Quiet Place', exact: true })
  await review.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'Review A Quiet Place', exact: true })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByLabel('TMDb movie ID', { exact: true })).toBeFocused()
  await page.keyboard.type('447332')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'TMDb candidate' })).toBeFocused()
  await expect(page.getByRole('button', { name: 'Confirm identity', exact: true })).toBeDisabled()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('checkbox')).toBeFocused()
  await page.keyboard.press('Space')
  const contrast = await page.getByRole('button', { name: 'Confirm identity', exact: true }).evaluate(element => {
    const style = globalThis.getComputedStyle(element)
    const luminance = color => {
      const channels = color.match(/\d+/g).slice(0, 3).map(value => {
        const channel = Number(value) / 255
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
      })
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
    }
    const values = [luminance(style.color), luminance(style.backgroundColor)].sort((a, b) => b - a)
    return (values[0] + 0.05) / (values[1] + 0.05)
  })
  expect(contrast).toBeGreaterThanOrEqual(4.5)
  await page.screenshot({ path: testInfo.outputPath('identity-review-desktop.png'), fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole('button', { name: 'Close menu' })).not.toBeInViewport()
  await page.locator('section[aria-labelledby="identity-review-heading"]').screenshot({ path: testInfo.outputPath('identity-review-mobile.png') })
  expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth)).toBe(true)
  await page.keyboard.press('Tab')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('status').filter({ hasText: 'Audit receipt 42' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Review media IDs', exact: true })).toBeFocused()
  expect(saved).toBe(true)
})
