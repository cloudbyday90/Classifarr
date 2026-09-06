/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@playwright/test'
import { libraryObservationSamplingFixture } from '../src/__tests__/fixtures/libraryObservationSamplingFixture'
import { libraryObservationHealthFixture } from '../src/__tests__/fixtures/libraryObservationHealthFixture'
import { libraryOverlapFixture } from '../src/__tests__/fixtures/libraryOverlapFixture'
import { checkKeyboardScroll } from './support/observationTableKeyboard'
import { incrementalLibraryCoverageFixture } from '../src/__tests__/fixtures/incrementalLibraryCoverageFixture'

for (const incremental of [false, true]) {
test(`${incremental ? 'incremental' : 'fair'} sampling shows bounded coverage, keyboard pagination and visit tables without operational requests`, async ({ page }, testInfo) => {
  let reads = 0
  let writes = 0
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const path = new globalThis.URL(route.request().url()).pathname
    if (route.request().method() !== 'GET') writes++
    let data = {}
    if (path === '/api/setup/status') data = { setupRequired: false }
    if (path === '/api/auth/me' || path === '/api/user/me') data = { id: 1, role: 'admin', username: 'operator' }
    if (path === '/api/notifications') data = { data: [] }
    if (path === '/api/notifications/active') data = []
    if (path === '/api/notifications/unread-count') data = { unread: 0 }
    if (path === '/api/libraries') data = Array.from({ length: 13 }, (_, index) => ({ id: index + 1,
      name: index === 0 ? 'Large archive' : `Collection ${index + 1}`, is_active: true, media_type: 'movie' }))
    if (path === '/api/libraries/observation-health') data = libraryObservationHealthFixture()
    if (path === '/api/libraries/overlap') data = libraryOverlapFixture()
    if (path === '/api/libraries/observation-history') { reads++; data = incremental ? incrementalLibraryCoverageFixture() : libraryObservationSamplingFixture() }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) })
  })
  await page.goto('/libraries')
  const section = page.getByRole('region', { name: 'Metadata acquisition progress', exact: true })
  await expect(section.getByRole('status').filter({ hasText: 'Acquisition history loaded.' })).toBeVisible()
  await expect(section.locator('h4')).toHaveCount(12)
  if (incremental) {
    await expect(section.getByText('20000 rows scanned; more remain. Complete coverage is not available yet.')).toBeVisible()
    await expect(section.getByText('Inputs changed before this visit could be saved. The scan will restart automatically.')).toBeVisible()
  } else {
    await expect(section.getByText("Inventory exceeds 20,000 rows; this library's coverage is unknown.")).toBeVisible()
  }
  await section.getByRole('button', { name: 'Next libraries' }).focus()
  await page.keyboard.press('Enter')
  await expect(section.getByRole('heading', { name: 'Collection 13 (library 13)', exact: true })).toBeVisible()
  await section.getByRole('button', { name: 'Previous libraries' }).focus()
  await page.keyboard.press('Enter')
  for (const label of ['Large archive (library 1)', 'Collection 2 (library 2)']) {
    await section.getByText(`Recorded visits for ${label}`, { exact: true }).focus()
    await page.keyboard.press('Enter')
    await expect(section.getByRole('table', { name: `Recorded coverage for ${label}, newest first`, exact: true })).toBeVisible()
  }
  await section.getByRole('heading', { name: 'Coverage across libraries' }).scrollIntoViewIfNeeded()
  await page.screenshot({ path: testInfo.outputPath('fair-sampling-desktop.png') })
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth)).toBe(true)
  const region = section.getByRole('region', { name: 'Coverage trend table for Collection 2 (library 2)', exact: true })
  await checkKeyboardScroll(page, region)
  await region.scrollIntoViewIfNeeded()
  await page.screenshot({ path: testInfo.outputPath('fair-sampling-mobile.png') })
  expect(reads).toBe(1)
  expect(writes).toBe(0)
})
}
