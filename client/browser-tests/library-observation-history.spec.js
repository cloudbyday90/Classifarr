/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@playwright/test'
import { libraryObservationHistoryFixture } from '../src/__tests__/fixtures/libraryObservationHistoryFixture.js'
import { libraryObservationHealthFixture } from '../src/__tests__/fixtures/libraryObservationHealthFixture.js'
import { libraryOverlapFixture } from '../src/__tests__/fixtures/libraryOverlapFixture.js'

import { checkKeyboardScroll } from './support/observationTableKeyboard'

test('automatically shows acquisition history with keyboard tables and mobile containment', async ({ page }, testInfo) => {
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
    if (path === '/api/libraries') data = [{ id: 1, name: 'Movies', is_active: true, media_type: 'movie' }]
    if (path === '/api/libraries/observation-health') data = libraryObservationHealthFixture()
    if (path === '/api/libraries/overlap') data = libraryOverlapFixture()
    if (path === '/api/libraries/observation-history') { reads++; data = libraryObservationHistoryFixture() }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) })
  })
  await page.goto('/libraries')
  const section = page.getByRole('region', { name: 'Metadata acquisition progress', exact: true })
  await expect(section.getByRole('status')).toHaveText('Acquisition history loaded.')
  await expect(section.getByText(/Most recent coverage: keywords 4 \/ 8/)).toBeVisible()
  for (const summary of await section.locator('summary').all()) {
    await summary.focus()
    await page.keyboard.press('Enter')
  }
  await expect(section.getByRole('table', { name: 'Acquisition outcomes by UTC hour, newest first' })).toBeVisible()
  await expect(section.getByRole('table', { name: 'Hourly coverage samples, newest first' })).toBeVisible()
  await expect(section.getByRole('table', { name: 'Hourly coverage for Movies (library 1), newest first', exact: true })).toBeVisible()
  await expect(section.getByText('Inventory population changed; comparison withheld.', { exact: true }).first()).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  await section.scrollIntoViewIfNeeded()
  expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth)).toBe(true)
  const region = section.getByRole('region', { name: 'Coverage history table', exact: true })
  await checkKeyboardScroll(page, region)
  await section.locator('h2').scrollIntoViewIfNeeded()
  await page.screenshot({ path: testInfo.outputPath('observation-history-mobile.png') })
  await region.scrollIntoViewIfNeeded()
  await page.screenshot({ path: testInfo.outputPath('observation-history-tables-mobile.png') })
  const trendRegion = section.getByRole('region', { name: 'Coverage trend table for Movies (library 1)', exact: true })
  await checkKeyboardScroll(page, trendRegion)
  await trendRegion.scrollIntoViewIfNeeded()
  await page.screenshot({ path: testInfo.outputPath('library-trends-mobile.png') })
  expect(reads).toBe(1)
  expect(writes).toBe(0)
})
