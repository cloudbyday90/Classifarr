/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@playwright/test'
import { URL } from 'node:url'

test('automatically presents separate evidence populations with keyboard and mobile access', async ({ page }, testInfo) => {
  let writes = 0
  const coverage = { status: 'available', captured_at: '2026-09-07T00:00:00Z', deleted_feedback_receipts: 1,
    history: { totals: { events: 70 }, group_count: 2, truncated: false, groups: [
      { library_id: 1, library_name: 'Observed movies', library_active: true, method: 'source_library',
        events: 60, imported_observations: 60, original_candidates: 0, linked_feedback: 0 },
      { library_id: 1, library_name: 'Observed movies', library_active: true, method: 'policy_auto',
        events: 10, imported_observations: 0, original_candidates: 7, linked_feedback: 5 },
    ] },
    feedback: { totals: { observations: 8, evaluated: 4, evaluation_coverage: 0.5 }, group_count: 2, truncated: false, groups: [
      { library_id: 2, library_name: 'Selected movies', library_active: true, method: 'policy_auto',
        observations: 5, source_bound: 5, evaluated: 3, evaluation_coverage: 0.6 },
      { library_id: 1, library_name: 'Observed movies', library_active: true, method: 'source_history_removed',
        observations: 3, source_bound: 3, evaluated: 1, evaluation_coverage: 1 / 3 },
    ] } }
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const path = new URL(route.request().url()).pathname
    if (route.request().method() !== 'GET') writes++
    let data = {}
    if (path === '/api/setup/status') data = { setupRequired: false }
    if (path === '/api/auth/me' || path === '/api/user/me') data = { id: 1, role: 'admin', username: 'operator' }
    if (path === '/api/notifications') data = { data: [] }
    if (path === '/api/notifications/unread-count') data = { unread: 0 }
    if (path === '/api/stats/overview') data = { evidence_coverage: coverage, total_decisions: 8, evaluated_decisions: 4 }
    if (['/api/stats/policies', '/api/stats/live-feed', '/api/stats/alerts'].includes(path)) data = []
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) })
  })
  await page.setViewportSize({ width: 1280, height: 1600 })
  await page.goto('/policy-stats')
  const section = page.getByRole('region', { name: 'Available evidence', exact: true })
  await expect(section.getByRole('table')).toHaveCount(2)
  await expect(section.getByRole('columnheader', { name: 'Imported membership', exact: true })).toBeVisible()
  await expect(section.getByText('Source history removed', { exact: true })).toBeVisible()
  await expect(section.getByText(/50.0% of feedback/)).toBeVisible()
  await section.screenshot({ path: testInfo.outputPath('evidence-coverage-desktop.png') })
  await page.setViewportSize({ width: 390, height: 844 })
  await section.scrollIntoViewIfNeeded()
  expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth)).toBe(true)
  const region = section.getByRole('region', { name: 'History evidence table' })
  await region.focus()
  await page.keyboard.press('ArrowRight')
  await expect.poll(() => region.evaluate(element => element.scrollLeft)).toBeGreaterThan(0)
  const contrast = await section.locator('p').first().evaluate(element => {
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
  await expect(section.getByRole('link', { name: 'Library profiles' })).toHaveAttribute('href', '/libraries')
  await page.screenshot({ path: testInfo.outputPath('evidence-coverage-mobile-history.png') })
  await section.getByRole('region', { name: 'Feedback evidence table' }).scrollIntoViewIfNeeded()
  await page.screenshot({ path: testInfo.outputPath('evidence-coverage-mobile-feedback.png') })
  expect(writes).toBe(0)
})
