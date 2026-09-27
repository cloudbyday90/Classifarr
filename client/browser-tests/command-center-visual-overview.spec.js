/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@playwright/test'
import { URL } from 'node:url'
import { sourceIssuePage } from '../src/__tests__/fixtures/sourceIdentityIssues.js'

const asOf = '2026-09-26T12:00:00Z'
const profile = { current: 10, queued: 0, processing: 0, retryWait: 0, cooldown: 0,
  waiting: 0, paused: 0, unverified: 0, noInventory: 0, missing: 0 }
const readiness = {
  version: 'library.upgrade_readiness.v1', asOf, libraryCount: 10, activeLibraryCount: 10,
  mediaTypes: { movie: 5, tv: 5, other: 0 }, profile, upgradeEnrollmentRecorded: true,
  recovery: { plannerOverdue: 0, workerOverdue: 0, leaseRecoveryOverdue: 0, graceMinutes: 15 },
  sourceIdentity: { completeCaptureLibraryCount: 10, unresolvedItemCount: 11,
    conflictingProviderItemCount: 11, invalidProviderItemCount: 0, invalidMediaTypeItemCount: 0,
    scope: 'active_complete_full_captures_last_30_days' },
  understanding: { version: 'library.understanding_summary.v1', asOf, libraryCount: 10,
    profile: { current: 10, updating: 0, coolingDown: 0, unverified: 0, paused: 0, noInventory: 0 },
    recovery: { overdueLibraryCount: 0, workerStalled: false },
    sourceIdentity: { unresolvedItemCount: 11, coveredActiveLibraryCount: 10, activeLibraryCount: 10 },
    classificationQuality: 'not_measured' },
}

test('visual overview has truthful counts, matching recovery items, keyboard access and no writes', async ({ page }, testInfo) => {
  let writes = 0, issueReads = 0, denied = false
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const url = new URL(route.request().url()), path = url.pathname
    if (route.request().method() !== 'GET') writes++
    let data = {}, status = 200
    if (path === '/api/setup/status') data = { setupRequired: false }
    if (['/api/auth/me', '/api/user/me'].includes(path)) data = { id: 1, role: 'admin', username: 'fixture-operator' }
    if (path === '/api/notifications') data = { data: [] }
    if (path === '/api/notifications/unread-count') data = { unread: 0 }
    if (['/api/libraries', '/api/classification/progress', '/api/queue/pending', '/api/queue/failed'].includes(path)) data = []
    if (path === '/api/queue/live-stats') data = { queue: { pending: 0 }, health: { ai: true, worker: true } }
    if (path === '/api/classification/pending') data = { items: Array.from({ length: 4 }, (_, i) => ({
      id: i + 1, title: `Pending fixture ${i + 1}`, media_type: 'movie', status: 'awaiting_decision',
    })) }
    if (path === '/api/libraries/profile-refresh-status') data = {
      version: 'library.profile_refresh_status.v1', asOf, windowTruncated: false,
      libraries: Array.from({ length: 10 }, (_, i) => ({ libraryId: i + 1, name: `Library ${i + 1}`, isActive: true,
        statusId: 'current', sourceRevision: '1', acknowledgedRevision: '1', profileRevision: '1' })),
    }
    if (path === '/api/libraries/upgrade-readiness') data = readiness
    if (path === '/api/libraries/source-identity-issues') {
      issueReads++
      if (denied) status = 403
      data = sourceIssuePage(Number(url.searchParams.get('offset') || 0), 51)
      data.recovery = { retry_wait: 1, retry_due: 1, source_review: 1, not_recorded: 48 }
      if (!data.offset) {
        Object.assign(data.items[0], { recoveryState: 'retry_wait', retryAfter: '2026-09-27T12:00:00Z',
          lastRecovery: { reason: 'provider_unavailable', attemptedAt: '2026-09-26T10:00:00Z', completedAt: '2026-09-26T11:00:00Z' } })
        Object.assign(data.items[1], { recoveryState: 'retry_due', retryAfter: '2026-09-25T12:00:00Z' })
        Object.assign(data.items[2], { recoveryState: 'source_review',
          lastRecovery: { reason: 'external_ids_disagree', attemptedAt: '2026-09-26T10:00:00Z', completedAt: '2026-09-26T11:00:00Z' } })
      }
    }
    if (path === '/api/reclassification/batches/activity') data = { batches: [], nextCursor: null }
    if (path.includes('native-intent-reconciliation') || path.includes('held-out-semantic')) status = 403
    await route.fulfill({ status, contentType: 'application/json', headers: { 'Cache-Control': 'no-store' }, body: JSON.stringify(data) })
  })
  await page.goto('/')
  const panel = page.getByRole('region', { name: 'Your libraries at a glance' })
  await expect(panel.getByRole('img', { name: '10 of 10 library summaries current (100%)' })).toBeVisible()
  await expect(panel.locator('.issue-number')).toHaveText('11')
  await expect(panel.locator('.decision-number')).toHaveText('4')
  await expect(panel).toContainText('Review the pending decisions')
  expect(issueReads).toBe(0)
  await panel.screenshot({ path: testInfo.outputPath('overview-desktop.png') })
  await panel.getByRole('link', { name: 'Open pending items' }).first().click()
  await expect(page.locator('#needs-attention')).toBeFocused()
  await panel.getByRole('link', { name: 'See library status' }).click()
  await expect(page.locator('#libraries')).toBeFocused()
  await expect(page.locator('#libraries')).toContainText('Library 1')
  const issuesButton = panel.getByRole('button', { name: 'See items & recovery' })
  await issuesButton.focus(); await page.keyboard.press('Enter')
  const issues = panel.getByRole('region', { name: 'Metadata issues' })
  await expect(issues).toContainText('The overview showed 11')
  await expect(issues).toContainText('Automatic retry waiting')
  await expect(issues).toContainText('Fixture title 1')
  await expect(issues).toContainText('Metadata provider request failed')
  await expect(issues).toContainText('Independent IDs point to different titles')
  await expect(issues).toContainText('No conflicting ID was selected')
  await issues.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(issues).toContainText('51–51 of 51')
  await expect(issues.getByRole('heading', { name: 'Metadata issues' })).toBeFocused()
  await issues.getByRole('button', { name: 'First page' }).click()
  await expect(issues).toContainText('1–50 of 51')
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 })
    await panel.scrollIntoViewIfNeeded()
    expect(await panel.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
  }
  await issues.screenshot({ path: testInfo.outputPath('issues-mobile.png') })
  await panel.getByRole('button', { name: 'Hide items', exact: true }).click()
  await page.locator('main.overflow-y-auto').evaluate(element => { element.scrollTop = 0 })
  await expect(panel.getByRole('heading', { name: 'Your libraries at a glance' })).toBeInViewport()
  await page.screenshot({ path: testInfo.outputPath('overview-mobile.png') })
  await panel.getByRole('button', { name: 'See items & recovery' }).click()
  await expect(issues).toContainText('Fixture title 1')
  denied = true
  await issues.getByRole('button', { name: 'Refresh items' }).click()
  await expect(issues).toContainText('Metadata issues are unavailable')
  await expect(issues).not.toContainText('Fixture title')
  expect(await page.evaluate(() => globalThis.localStorage.getItem('classifarr:v1:swr:command-center:source-identity-issues'))).toBeNull()
  expect(writes).toBe(0)
})
