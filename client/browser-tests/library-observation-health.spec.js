/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@playwright/test'
import { libraryObservationHealthFixture } from '../src/__tests__/fixtures/libraryObservationHealthFixture.js'
import { libraryOverlapFixture } from '../src/__tests__/fixtures/libraryOverlapFixture.js'
import { libraryObservationHistoryFixture } from '../src/__tests__/fixtures/libraryObservationHistoryFixture.js'

test('automatically explains observation health with keyboard access, contrast and mobile scrolling', async ({ page }, testInfo) => {
  let writes = 0
  let healthReads = 0
  const report = libraryObservationHealthFixture()
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
    if (path === '/api/libraries/overlap') data = libraryOverlapFixture()
    if (path === '/api/libraries/observation-history') data = libraryObservationHistoryFixture()
    if (path === '/api/libraries/observation-health') { healthReads++; data = report }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) })
  })
  await page.goto('/libraries')
  const section = page.getByRole('region', { name: 'Metadata coverage and freshness', exact: true })
  await expect(section.getByRole('table', { name: 'Observation coverage by library' })).toBeVisible()
  await expect(section.getByText('Observation health loaded. Libraries measured: 1.', { exact: true })).toBeVisible()
  const summary = section.locator('summary')
  await summary.focus()
  await page.keyboard.press('Enter')
  await expect(section.getByRole('table', { name: 'Acquisition states for Movies (#1)' })).toBeVisible()
  await expect(section.getByRole('rowheader', { name: 'Waiting between attempts', exact: true })).toBeVisible()
  await expect(section.getByText(/A task does not prove that TMDb/)).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  await section.scrollIntoViewIfNeeded()
  expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth)).toBe(true)
  const scrollRegion = section.getByRole('region', { name: 'Observation coverage table' })
  await scrollRegion.focus()
  await page.keyboard.press('ArrowRight')
  await expect.poll(() => scrollRegion.evaluate(element => element.scrollLeft)).toBeGreaterThan(0)
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
  await scrollRegion.evaluate(element => { element.scrollLeft = 0 })
  await section.scrollIntoViewIfNeeded()
  await page.screenshot({ path: testInfo.outputPath('observation-health-mobile.png') })
  await section.getByText(/A task does not prove that TMDb/).scrollIntoViewIfNeeded()
  await page.screenshot({ path: testInfo.outputPath('observation-health-details-mobile.png') })
  expect(healthReads).toBe(1)
  expect(writes).toBe(0)
})
