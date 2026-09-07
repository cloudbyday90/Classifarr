/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@playwright/test'
import { URL } from 'node:url'
import { dailyProvenanceFixture } from '../src/__tests__/helpers/dailyProvenanceFixture'

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
    evaluated_decisions: 4, evaluation_coverage: 0.5, accuracy_rate: 0.75, last_7_days_accuracy: 1,
    auto_classified: 2, trend: 'improving' }
  let comparisonPeriods = [
    { period: 'last_7_days', decisions: '4', accuracy: '1.0', auto_rate: '50' },
    { period: 'previous_7_days', decisions: '4', accuracy: '0.5', auto_rate: '0' },
  ]
  const coverage = { status: 'available', captured_at: '2026-09-07T00:00:00Z', deleted_feedback_receipts: 1,
    recording_time_coverage: { events: 70, recorded_events: 10, unknown_events: 60 },
    provenance_trend: dailyProvenanceFixture({ events: 10, captured_events: 9, unrecorded_events: 1, invalid_events: 0, unsupported_events: 0 }, 60),
    history: { totals: { events: 70, completed_events: 64, pending_events: 3, retry_events: 2, other_events: 1,
      original_candidates: 7, candidate_no_proposal: 1, candidate_invalid: 1, candidate_not_applicable: 60, candidate_unrecorded: 1 }, group_count: 2, truncated: false, groups: [
      { library_id: 1, library_name: 'Observed movies', library_active: true, method: 'source_library',
        events: 60, completed_events: 60, pending_events: 0, retry_events: 0, other_events: 0,
        imported_observations: 60, original_candidates: 0, linked_feedback: 0,
        candidate_no_proposal: 0, candidate_invalid: 0, candidate_not_applicable: 60, candidate_unrecorded: 0 },
      { library_id: 1, library_name: 'Observed movies', library_active: true, method: 'policy_auto',
        events: 10, completed_events: 4, pending_events: 3, retry_events: 2, other_events: 1,
        imported_observations: 0, original_candidates: 7, linked_feedback: 5,
        candidate_no_proposal: 1, candidate_invalid: 1, candidate_not_applicable: 0, candidate_unrecorded: 1 },
    ] },
    history_attribution: { totals: { events: 70, captured_events: 9, unrecorded_events: 61, invalid_events: 0, unsupported_events: 0 },
      group_count: 3, truncated: false, groups: [
        { library_id: 1, library_name: 'Observed movies', library_active: true, original_method: null,
          candidate_source: null, recorded_method: 'source_library', provenance_status: 'unrecorded', events: 60 },
        { library_id: 1, library_name: 'Observed movies', library_active: true, original_method: 'policy_prompt',
          candidate_source: 'policy_ranked', recorded_method: 'policy_auto', provenance_status: 'captured', events: 9 },
        { library_id: 1, library_name: 'Observed movies', library_active: true, original_method: null,
          candidate_source: null, recorded_method: 'policy_auto', provenance_status: 'unrecorded', events: 1 },
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
      avg_accuracy: 0.75, evaluation_coverage: 0.5, auto_rate: 0.25, improving_count: 1, declining_count: 0 }
    if (path === '/api/stats/policies') data = [policy]
    if (['/api/stats/live-feed', '/api/stats/alerts'].includes(path)) data = []
    if (path === '/api/stats/policies/3') data = { ...policy,
      prompt_breakdown: [{ prompt_type: 'auto_classify', count: 2, accuracy: 0.5 }] }
    if (path === '/api/stats/policies/3/compare') data = comparisonPeriods
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
  await expect(section.getByRole('table')).toHaveCount(4)
  const recordingTimes = section.getByRole('region', { name: 'History recording times', exact: true })
  await expect(recordingTimes).toContainText('10 of 70 retained history events have a known recording time. 60 have an unknown recording time.')
  expect(await recordingTimes.locator('p').first().evaluate(textContrast)).toBeGreaterThanOrEqual(4.5)
  const trend = section.getByRole('region', { name: 'Daily provenance coverage table' })
  await expect(trend.getByRole('table')).toHaveAccessibleName('Original method capture by stored history date')
  await expect(trend.getByRole('columnheader')).toHaveCount(7)
  await expect(trend.getByRole('rowheader')).toHaveCount(14)
  await expect(trend.getByText('Today (partial)', { exact: true })).toHaveCount(1)
  await expect(trend.getByRole('row').last()).toContainText('90.0%')
  await expect(trend.getByRole('cell', { name: 'N/A', exact: true })).toHaveCount(13)
  const attribution = section.getByRole('region', { name: 'Original method attribution table' })
  await expect(attribution.getByRole('table')).toHaveAccessibleName('Retained history by original and recorded method')
  await expect(attribution.getByRole('columnheader')).toHaveCount(5)
  await expect(attribution.getByRole('row').filter({ hasText: 'policy prompt' })).toContainText('Policy ranking')
  await expect(attribution.getByRole('row').filter({ hasText: 'policy prompt' })).toContainText('policy auto')
  await expect(section.getByText(/Original method captured for 9 of 70 history events/)).toBeVisible()
  await expect(section.getByRole('columnheader', { name: 'Imported membership', exact: true })).toBeVisible()
  await expect(section.getByText('Source history removed', { exact: true })).toBeVisible()
  await expect(section.getByText(/50.0% of feedback/)).toBeVisible()
  await expect(section.locator('dl').first().locator('dt')).toHaveText(['Completed', 'Pending decision', 'Retry pending', 'Other'])
  await expect(section.locator('dl').first().locator('dd')).toHaveText(['64', '3', '2', '1'])
  await expect(section.getByRole('row').filter({ hasText: 'policy auto' }).first().locator('.lifecycle-counts dd')).toHaveText(['4', '3', '2', '1'])
  await expect(section.locator('.capture-counts').first().locator('dt')).toHaveText(['No proposal', 'Invalid evidence', 'Not applicable', 'Unrecorded'])
  await expect(section.locator('.capture-counts').first().locator('dd')).toHaveText(['1', '1', '60', '1'])
  await expect(section.getByText('7 original candidates recorded.', { exact: true })).toBeVisible()
  expect(await section.locator('dt').first().evaluate(textContrast)).toBeGreaterThanOrEqual(4.5)
  await section.screenshot({ path: testInfo.outputPath('evidence-coverage-desktop.png') })
  await section.locator('.daily-provenance').scrollIntoViewIfNeeded()
  await section.locator('.daily-provenance').screenshot({ path: testInfo.outputPath('evidence-coverage-desktop-trend.png') })
  await page.setViewportSize({ width: 390, height: 844 })
  await recordingTimes.scrollIntoViewIfNeeded()
  await recordingTimes.screenshot({ path: testInfo.outputPath('history-recording-times-mobile.png'), animations: 'disabled' })
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
  await attribution.scrollIntoViewIfNeeded()
  await attribution.focus()
  await page.keyboard.press('ArrowRight')
  await expect.poll(() => attribution.evaluate(element => element.scrollLeft)).toBeGreaterThan(0)
  expect(await attribution.getByRole('columnheader').first().evaluate(textContrast)).toBeGreaterThanOrEqual(4.5)
  await page.screenshot({ path: testInfo.outputPath('evidence-coverage-mobile-attribution.png') })
  await trend.scrollIntoViewIfNeeded()
  await trend.focus()
  await page.keyboard.press('ArrowRight')
  await expect.poll(() => trend.evaluate(element => element.scrollLeft)).toBeGreaterThan(0)
  expect(await trend.getByRole('columnheader').first().evaluate(textContrast)).toBeGreaterThanOrEqual(4.5)
  await page.screenshot({ path: testInfo.outputPath('evidence-coverage-mobile-trend.png') })
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
  const comparisonTable = page.getByRole('table', { name: 'Policy metrics for the last 7 days and previous 7 days' })
  await expect(comparisonTable.getByRole('columnheader')).toHaveCount(4)
  await expect(comparisonTable.getByRole('rowheader')).toHaveCount(3)
  await expect(comparisonTable.getByRole('row', { name: /^Accuracy / }).getByRole('cell')).toHaveText([
    '100.0%', '50.0%', '+50.0 percentage points',
  ])
  await expect(comparisonTable.getByRole('row', { name: /^Auto Rate / }).getByRole('cell')).toHaveText([
    '50.0%', '0.0%', '+50.0 percentage points',
  ])
  for (const selector of ['.comparison-section th', '.comparison-section td', '.comparison-help', '.stats-modal .evaluation-coverage', '.scope-description']) {
    for (const description of await page.locator(selector).all()) {
      expect(await description.evaluate(textContrast)).toBeGreaterThanOrEqual(4.5)
    }
  }
  await page.screenshot({ path: testInfo.outputPath('statistics-scopes-detail.png') })
  await page.getByRole('button', { name: 'Close modal', exact: true }).click()
  comparisonPeriods = [
    { period: 'last_7_days', decisions: 0, accuracy: null, auto_rate: null },
    comparisonPeriods[1],
  ]
  await performance.getByRole('button').click()
  await expect(comparisonTable.getByRole('row', { name: /^Auto Rate / }).getByRole('cell')).toHaveText(['N/A', '0.0%', 'N/A'])
  await expect(comparisonTable.getByRole('row', { name: /^Decisions / }).getByRole('cell')).toHaveText(['0', '4', '-4'])
  await page.setViewportSize({ width: 320, height: 844 })
  const comparisonScroll = page.getByRole('region', { name: '7-day comparison table', exact: true })
  await comparisonScroll.focus()
  await page.keyboard.press('ArrowRight')
  await expect.poll(() => comparisonScroll.evaluate(element => element.scrollLeft)).toBeGreaterThan(0)
  const comparisonBounds = await comparisonScroll.boundingBox()
  expect(comparisonBounds.x).toBeGreaterThanOrEqual(0)
  expect(comparisonBounds.x + comparisonBounds.width).toBeLessThanOrEqual(320)
  await page.screenshot({ path: testInfo.outputPath('statistics-comparison-mobile.png') })
  expect(writes).toBe(0)
})
