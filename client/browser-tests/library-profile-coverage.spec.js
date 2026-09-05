/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@playwright/test'
import { URL } from 'node:url'

test('library coverage explains common traits without asking for operational input', async ({ page }, testInfo) => {
  let writes = 0
  const observation = { version: 'library.profile_observation.v1', population: 'inventory_rows', itemCount: 3,
    traits: Object.fromEntries(['rating', 'genres', 'studio', 'keywords', 'language'].map(field => [field, { observedCount: 2, unknownCount: 1 }])) }
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const path = new URL(route.request().url()).pathname
    if (route.request().method() !== 'GET') writes++
    let data = {}
    if (path === '/api/setup/status') data = { setupRequired: false }
    if (path === '/api/auth/me' || path === '/api/user/me') data = { id: 1, role: 'admin', username: 'operator' }
    if (path === '/api/notifications') data = { data: [] }
    if (path === '/api/notifications/unread-count') data = { unread: 0 }
    if (path === '/api/libraries/1') data = { id: 1, name: 'Observed movies', media_type: 'movie', is_active: true, item_count: 3 }
    if (path === '/api/libraries/1/rules') data = []
    if (path === '/api/libraries/1/profile') data = { item_count: 3, enriched_count: 2, last_generated_at: '2026-08-31T12:00:00Z',
      rating_distribution: { PG: 66.7 }, genre_distribution: { Action: 66.7, Drama: 33.3 }, studio_distribution: {},
      exclusion_ratings: ['R'], exclusion_genres: [], observation_summary: observation }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) })
  })
  await page.goto('/libraries/1')
  const table = page.getByRole('table', { name: 'Metadata coverage' })
  await expect(table).toBeVisible()
  await expect(table.getByRole('columnheader', { name: 'Known', exact: true })).toBeVisible()
  await expect(table.getByRole('rowheader', { name: 'Genres', exact: true })).toBeVisible()
  await expect(page.getByText('Action (66.7%)', { exact: true })).toBeVisible()
  await expect(page.getByText('Never in this library', { exact: true })).toHaveCount(0)
  const contrast = await page.locator('.profile-maintenance-help').evaluate(element => {
    const luminance = color => {
      const channels = color.match(/\d+/g).slice(0, 3).map(value => {
        const channel = Number(value) / 255
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
      })
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
    }
    const values = [globalThis.getComputedStyle(element).color, globalThis.getComputedStyle(element.closest('.library-profile')).backgroundColor]
      .map(luminance).sort((a, b) => b - a)
    return (values[0] + 0.05) / (values[1] + 0.05)
  })
  expect(contrast).toBeGreaterThanOrEqual(4.5)
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole('button', { name: 'Close menu' })).not.toBeInViewport()
  await page.locator('.library-profile').screenshot({ path: testInfo.outputPath('library-profile-coverage-mobile.png') })
  expect(await table.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
  expect(writes).toBe(0)
})
