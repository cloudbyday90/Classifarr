/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@playwright/test'
import { URL } from 'node:url'
import { normalizeEvaluationGaps } from '../src/utils/evaluationCoverageGaps.js'

test('saved evaluation coverage is compact, keyboard-pausable and clears after lost access', async ({ page }, testInfo) => {
  let paired = 20, denied = false, reads = 0, writes = 0
  await page.clock.install()
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const path = new URL(route.request().url()).pathname
    if (route.request().method() !== 'GET') writes++
    let data = {}, status = 200
    if (path === '/api/setup/status') data = { setupRequired: false }
    if (['/api/auth/me', '/api/user/me'].includes(path)) data = { id: 1, role: 'admin', username: 'synthetic-operator' }
    if (path === '/api/notifications') data = { data: [] }
    if (path === '/api/notifications/unread-count') data = { unread: 0 }
    if (path === '/api/reclassification/batches/activity') data = { batches: [], nextCursor: null }
    if (['/api/libraries', '/api/classification/progress', '/api/queue/pending', '/api/queue/failed'].includes(path)) data = []
    if (path === '/api/queue/live-stats') data = { queue: { pending: 0 }, health: { ai: true, worker: true } }
    if (path.includes('native-intent-reconciliation') || path.includes('held-out-semantic')) status = 403
    if (path === '/api/stats/evaluation-history') {
      reads++
      if (denied) status = 403
      else data = { version: 'evaluation_history_summary.v4', retentionDays: 30, windowLimit: 500, windows: 3, revisions: 1,
        activity: { checkedAt: '2026-10-09T12:00:00Z',
          policy: { status: 'complete', observedAt: '2026-10-09T12:00:00Z', counts: { cases: 300, paired: 300,
            baseline: { automatic: 40, review: 37, manual: 223, unavailable: 0 },
            sourceAware: { automatic: 40, review: 37, manual: 223, unavailable: 0 } } },
          capture: { enabled: false, dailyCalls: 0, dailyTokens: 0, quotaDay: '2026-10-09',
            callsReserved: 0, tokensReserved: 0, lastOutcome: 'disabled' } },
        groups: [{ latestAt: '2026-09-25T12:00:00Z', windows: 3, sampled: 300, eligible: 120, selected: 50, paired,
          labeled: 5, gains: 2, regressions: 1, deferralsReduced: 4, deferralsIncreased: 1, moviePaired: paired - 10, tvPaired: 10,
          deterministicPairs: 5, mixedPairs: 10, aiPairs: paired - 15, legacyPairs: 0,
          gaps: { ...normalizeEvaluationGaps(null, 0, true), cache_missing: 48 - paired, invalid_response: 2 } }],
        providerCalls: 0, routingWrites: 0, promotionAllowed: false, fullPipelineAccuracy: null }
    }
    await route.fulfill({ status, contentType: 'application/json', headers: { 'Cache-Control': 'no-store' }, body: JSON.stringify(data) })
  })
  await page.goto('/')
  const panel = page.getByRole('region', { name: 'Evaluation progress' })
  await expect(panel).toContainText('20 completed comparisons from 120 candidate items')
  await expect(panel).toContainText('300 cases evaluated by policy replay')
  await expect(panel).toContainText('Disabled — no AI calls are scheduled for evaluation capture')
  await expect(panel.locator('details')).not.toHaveAttribute('open')
  await panel.screenshot({ path: testInfo.outputPath('evaluation-history-desktop.png') })
  await panel.getByRole('button', { name: 'Pause summary' }).focus()
  await page.keyboard.press('Space')
  paired = 25
  // Advance one polling interval without replaying every unrelated dashboard animation frame.
  await page.clock.fastForward(300_000)
  await expect.poll(() => reads).toBeGreaterThan(1)
  await expect(panel).toContainText('20 completed comparisons')
  await panel.getByRole('button', { name: 'Resume summary' }).press('Space')
  await expect(panel).toContainText('25 completed comparisons')
  const disclosure = panel.locator('summary')
  await disclosure.focus(); await page.keyboard.press('Enter')
  await expect(panel.locator('details')).toHaveAttribute('open', '')
  await expect(panel).toContainText('historical results, not live model verification')
  await expect(panel).toContainText('23 — Cached AI response missing')
  await expect(panel).toContainText('2 — AI response rejected')
  await expect(panel).toContainText('No retries are started by opening this summary')
  await expect(panel).toContainText('5 deterministic-only · 10 mixed policy/AI · 10 AI-only')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.clock.runFor(1000)
  await expect.poll(() => page.locator('aside').evaluate(element => element.getBoundingClientRect().right)).toBeLessThanOrEqual(0)
  await panel.scrollIntoViewIfNeeded()
  expect(await panel.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
  const bounds = await panel.boundingBox()
  expect(bounds.x).toBeGreaterThanOrEqual(0)
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(390)
  await panel.screenshot({ path: testInfo.outputPath('evaluation-history-mobile.png') })
  expect(await page.evaluate(() => globalThis.localStorage.getItem('classifarr:v1:swr:evaluation-history'))).toBeNull()
  await panel.getByRole('button', { name: 'Pause summary' }).press('Space')
  denied = true
  await page.clock.fastForward(300_000)
  await expect(panel).toHaveCount(0)
  expect(writes).toBe(0)
})
