/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@playwright/test'
import { libraryOverlapFixture } from '../src/__tests__/fixtures/libraryOverlapFixture.js'
import { libraryObservationHealthFixture } from '../src/__tests__/fixtures/libraryObservationHealthFixture.js'
import { libraryObservationHistoryFixture } from '../src/__tests__/fixtures/libraryObservationHistoryFixture.js'

test('library overlap loads without operational input and supports keyboard disclosures on desktop and mobile', async ({ page }, testInfo) => {
  let writes = 0
  let overlapReads = 0
  const report = libraryOverlapFixture()
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const path = new globalThis.URL(route.request().url()).pathname
    if (route.request().method() !== 'GET') writes++
    let data = {}
    if (path === '/api/setup/status') data = { setupRequired: false }
    if (path === '/api/auth/me' || path === '/api/user/me') data = { id: 1, role: 'admin', username: 'operator' }
    if (path === '/api/notifications') data = { data: [] }
    if (path === '/api/notifications/active') data = []
    if (path === '/api/notifications/unread-count') data = { unread: 0 }
    if (path === '/api/libraries') data = report.libraries.map(library => ({ ...library, is_active: true, media_type: 'movie' }))
    if (path === '/api/libraries/overlap') { overlapReads++; data = report }
    if (path === '/api/libraries/observation-health') data = libraryObservationHealthFixture()
    if (path === '/api/libraries/observation-history') data = libraryObservationHistoryFixture()
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) })
  })
  await page.goto('/libraries')
  const section = page.getByRole('region', { name: 'What libraries have in common', exact: true })
  await expect(section.getByRole('table', { name: 'Inventory and identity coverage' })).toBeVisible()
  await expect(section.getByText('Library comparisons loaded: 1.', { exact: true })).toBeVisible()
  await expect(section.getByText(/1 \/ 2 \(50%\) of Movies/)).toBeVisible()
  const summary = section.locator('summary')
  await summary.focus()
  await page.keyboard.press('Enter')
  await expect(section.getByText(/Insufficient coverage to compare this trait/)).toBeVisible()
  await expect(section.getByText(/Conflicting duplicate observations/)).toBeVisible()
  await page.keyboard.press('Space')
  await expect(section.locator('details')).not.toHaveAttribute('open', '')
  await page.setViewportSize({ width: 390, height: 844 })
  await section.scrollIntoViewIfNeeded()
  expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth)).toBe(true)
  await section.screenshot({ path: testInfo.outputPath('library-overlap-mobile.png') })
  const contrast = await section.locator('p.text-gray-300').first().evaluate(element => {
    const luminance = color => {
      const channels = color.match(/\d+/g).slice(0, 3).map(value => {
        const channel = Number(value) / 255
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
      })
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
    }
    const values = [globalThis.getComputedStyle(element).color, globalThis.getComputedStyle(element.closest('section')).backgroundColor]
      .map(luminance).sort((a, b) => b - a)
    return (values[0] + 0.05) / (values[1] + 0.05)
  })
  expect(contrast).toBeGreaterThanOrEqual(4.5)
  expect(overlapReads).toBe(1)
  expect(writes).toBe(0)
})
