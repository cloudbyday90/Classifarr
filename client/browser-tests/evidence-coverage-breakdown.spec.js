/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@playwright/test'
import { URL } from 'node:url'

function textContrast(element) {
  const luminance = color => {
    const channels = color.match(/[\d.]+/g).slice(0, 3).map(value => {
      const channel = Number(value) / 255
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
    })
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
  }
  let background = element
  while (background && globalThis.getComputedStyle(background).backgroundColor === 'rgba(0, 0, 0, 0)') {
    background = background.parentElement
  }
  const values = [globalThis.getComputedStyle(element).color, globalThis.getComputedStyle(background).backgroundColor]
    .map(luminance).sort((a, b) => b - a)
  return (values[0] + 0.05) / (values[1] + 0.05)
}

test('automatically presents scoped statistics and evidence with keyboard and mobile access', async ({ page }, testInfo) => {
  let writes = 0
  const statsReads = []
  const policy = { id: 3, name: 'Observed movies', library_name: 'Movie library', total_decisions: 8,
    evaluated_decisions: 4, evaluation_coverage: 0.5, accuracy_rate: 0.75, last_7_days_accuracy: 0.5,
    auto_classified: 2, trend: 'declining' }
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
    const url = new URL(route.request().url())
    const path = url.pathname
    if (route.request().method() !== 'GET') writes++
    if (path.startsWith('/api/stats/')) statsReads.push(`${path}${url.search}`)
    let data = {}
    if (path === '/api/setup/status') data = { setupRequired: false }
    if (path === '/api/auth/me' || path === '/api/user/me') data = { id: 1, role: 'admin', username: 'operator' }
    if (path === '/api/notifications') data = { data: [] }
    if (path === '/api/notifications/unread-count') data = { unread: 0 }
    if (path === '/api/stats/overview') data = { evidence_coverage: coverage, total_decisions: 8, evaluated_decisions: 4,
      avg_accuracy: 0.75, evaluation_coverage: 0.5, auto_rate: 0.25, improving_count: 0, declining_count: 1 }
    if (path === '/api/stats/policies') data = [policy]
    if (['/api/stats/live-feed', '/api/stats/alerts'].includes(path)) data = []
    if (path === '/api/stats/policies/3') data = { ...policy,
      prompt_breakdown: [{ prompt_type: 'auto_classify', count: 2, accuracy: 0.5 }] }
    if (path === '/api/stats/policies/3/compare') data = [
      { period: 'last_7_days', decisions: 2, accuracy: 0.5, auto_rate: 100 },
      { period: 'previous_7_days', decisions: 4, accuracy: 0.5, auto_rate: 0 },
    ]
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) })
  })
  await page.setViewportSize({ width: 1280, height: 1600 })
  await page.goto('/policy-stats')
  const overview = page.getByRole('region', { name: 'Policy Feedback Overview' })
  await expect(overview).toHaveAccessibleDescription(/all retained feedback.*including disabled policies.*equally.*last 7 days.*last 30 days/)
  await expect(page.getByRole('button', { name: /^(7 Days|30 Days|All Time)$/ })).toHaveCount(0)
  const performance = page.getByRole('region', { name: 'Policy Performance', exact: true })
  await expect(performance).toHaveAccessibleDescription(/Enabled policies.*all retained feedback.*7-day accuracy/)
  await expect(page.getByRole('region', { name: 'Live Activity' })).toHaveAccessibleDescription(/20 latest events.*feedback decisions.*patterns and suggestions.*last 7 days/)
  await expect(performance.getByRole('button')).toHaveCount(1)
  expect(statsReads.sort()).toEqual(['/api/stats/alerts', '/api/stats/live-feed?limit=20', '/api/stats/overview', '/api/stats/policies'])
  await page.screenshot({ path: testInfo.outputPath('statistics-scopes-desktop.png') })
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
  const contrast = await section.locator('p').first().evaluate(textContrast)
  expect(contrast).toBeGreaterThanOrEqual(4.5)
  await expect(section.getByRole('link', { name: 'Library profiles' })).toHaveAttribute('href', '/libraries')
  await page.screenshot({ path: testInfo.outputPath('evidence-coverage-mobile-history.png') })
  await section.getByRole('region', { name: 'Feedback evidence table' }).scrollIntoViewIfNeeded()
  await page.screenshot({ path: testInfo.outputPath('evidence-coverage-mobile-feedback.png') })
  await page.setViewportSize({ width: 320, height: 844 })
  await performance.scrollIntoViewIfNeeded()
  expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth)).toBe(true)
  const cardBounds = await performance.getByRole('button').boundingBox()
  expect(cardBounds.x).toBeGreaterThanOrEqual(0)
  expect(cardBounds.x + cardBounds.width).toBeLessThanOrEqual(320)
  await page.screenshot({ path: testInfo.outputPath('statistics-scopes-mobile.png') })
  await page.setViewportSize({ width: 1280, height: 1600 })
  await performance.getByRole('button').focus()
  await page.keyboard.press('Enter')
  await expect(page.getByText('Totals and accuracy use all retained feedback for this policy.')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Decision Breakdown (Last 30 Days)', exact: true })).toBeVisible()
  await expect(page.getByText('Last 7 Days', { exact: true })).toBeVisible()
  await expect(page.getByText('Previous 7 Days', { exact: true })).toBeVisible()
  await expect(page.getByText('This Week', { exact: true })).toHaveCount(0)
  for (const selector of ['.comparison-row span', '.stats-modal .evaluation-coverage', '.scope-description']) {
    for (const description of await page.locator(selector).all()) {
      expect(await description.evaluate(textContrast)).toBeGreaterThanOrEqual(4.5)
    }
  }
  await page.screenshot({ path: testInfo.outputPath('statistics-scopes-detail.png') })
  await page.getByRole('button', { name: 'Close modal', exact: true }).click()
  expect(writes).toBe(0)
})
