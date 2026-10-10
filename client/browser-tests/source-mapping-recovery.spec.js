/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@playwright/test'
import { URL } from 'node:url'
import { sourceIssuePage } from '../src/__tests__/fixtures/sourceIdentityIssues.js'

test('explicit mapping approval survives a lost response without clearing the unresolved count', async ({ page }, testInfo) => {
  const asOf = '2026-10-10T12:00:00Z', id = '2e851bf4-9497-4b99-8b7c-e8117a05c762'
  let approvals = 0, revocations = 0, draft
  const readiness = { version: 'library.upgrade_readiness.v1', asOf, libraryCount: 1, activeLibraryCount: 1,
    mediaTypes: { movie: 1, tv: 0, other: 0 }, upgradeEnrollmentRecorded: true,
    profile: { current: 1, queued: 0, processing: 0, retryWait: 0, cooldown: 0, waiting: 0, paused: 0, unverified: 0, noInventory: 0, missing: 0 },
    recovery: { plannerOverdue: 0, workerOverdue: 0, leaseRecoveryOverdue: 0, graceMinutes: 15 },
    sourceIdentity: { completeCaptureLibraryCount: 1, unresolvedItemCount: 1, conflictingProviderItemCount: 1,
      invalidProviderItemCount: 0, invalidMediaTypeItemCount: 0, scope: 'active_complete_full_captures_last_30_days' },
    understanding: { version: 'library.understanding_summary.v1', asOf, libraryCount: 1,
      profile: { current: 1, updating: 0, coolingDown: 0, unverified: 0, paused: 0, noInventory: 0 },
      recovery: { overdueLibraryCount: 0, workerStalled: false },
      sourceIdentity: { unresolvedItemCount: 1, coveredActiveLibraryCount: 1, activeLibraryCount: 1 }, classificationQuality: 'not_measured' } }
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const path = new URL(route.request().url()).pathname
    let data = {}
    if (path === '/api/setup/status') data = { setupRequired: false }
    if (['/api/auth/me', '/api/user/me'].includes(path)) data = { id: 1, role: 'admin', username: 'fixture' }
    if (path === '/api/notifications') data = { data: [] }
    if (path === '/api/notifications/unread-count') data = { unread: 0 }
    if (['/api/libraries', '/api/classification/progress', '/api/queue/pending', '/api/queue/failed'].includes(path)) data = []
    if (path === '/api/classification/pending') data = { items: [] }
    if (path === '/api/queue/live-stats') data = { queue: { pending: 0 }, health: { ai: true, worker: true } }
    if (path === '/api/libraries/profile-refresh-status') data = { version: 'library.profile_refresh_status.v1', asOf, windowTruncated: false, libraries: [] }
    if (path === '/api/libraries/upgrade-readiness') data = readiness
    if (path === '/api/libraries/source-identity-issues') {
      data = sourceIssuePage(); data.items[0].sourceVersion = 'b'.repeat(64); data.items[0].providerFields = ['tvdb_id']
    }
    if (path.endsWith('/review') && path.includes('/source-scopes/')) {
      const body = route.request().postDataJSON()
      draft = { version: 'source_scope_review.v1', sourceKey: '1'.padStart(64, '0'), sourceVersion: body.sourceVersion,
        draftFingerprint: 'c'.repeat(64), scope: body.scope, status: 'valid_draft', canApply: false, persisted: false,
        verification: 'structure_only', backfill: { eligible: false, excludedScope: 'all' } }
      data = draft
    }
    if (path.endsWith('/evidence')) data = { ...draft, version: 'source_scope_evidence.v1', reference: id,
      evidenceFingerprint: 'd'.repeat(64), verification: 'typed_catalog_membership', crossProviderVerified: false,
      comparison: { unit: 'movie', total: 1, matched: 1, exclusions: [] } }
    if (path.endsWith('/approve')) {
      approvals++
      expect(route.request().postDataJSON()).toMatchObject({ confirmed: true, evidenceFingerprint: 'd'.repeat(64), scope: { kind: 'whole_work', tmdbId: 10 } })
      await route.abort('failed'); return
    }
    if (path.endsWith('/source-scopes/mappings')) data = { version: 'source_mappings.v1', offset: 0, hasMore: false,
      items: approvals ? [{ id, title: 'Fixture title 1', libraryName: 'Fixture library', scope: { kind: 'whole_work', tmdbId: 10 },
        retryAfter: null, status: revocations ? 'revoked' : 'awaiting_sync' }] : [] }
    if (path.endsWith('/revoke')) { revocations++; data = { version: 'source_mapping_revocation.v1', mappingId: id, status: 'revoked' } }
    if (path === '/api/reclassification/batches/activity') data = { batches: [], nextCursor: null }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) })
  })
  await page.goto('/')
  const overview = page.getByRole('region', { name: 'Your libraries at a glance' })
  await overview.getByRole('button', { name: 'See items & recovery' }).click()
  await page.getByText('Draft a catalog mapping (admin)', { exact: true }).click()
  await page.getByLabel('TMDb movie ID', { exact: true }).fill('10')
  await page.getByRole('button', { name: 'Check draft structure' }).click()
  await page.getByRole('button', { name: 'Check source and catalog evidence' }).click()
  const approval = page.getByRole('region', { name: 'Approve complete source mapping' })
  await expect(approval.getByRole('button')).toBeDisabled()
  await approval.getByRole('checkbox').check()
  await approval.getByRole('button').focus(); await page.keyboard.press('Enter')
  await expect(approval.getByRole('alert')).toContainText('Check saved mappings')
  await expect(approval.getByRole('button')).toBeDisabled()
  const saved = page.getByRole('region', { name: 'Saved source mappings' })
  await saved.getByRole('button', { name: 'Refresh saved mappings' }).click()
  await expect(saved).toContainText('Awaiting successful verification')
  await expect(overview.locator('.issue-number')).toHaveText('1')
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 })
    await saved.scrollIntoViewIfNeeded()
    await page.evaluate(() => globalThis.scrollTo(0, globalThis.scrollY))
    expect(await saved.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
    expect(await saved.evaluate(element => element.getBoundingClientRect().left >= 0 && element.getBoundingClientRect().right <= globalThis.innerWidth)).toBe(true)
  }
  // A taller capture shows the whole panel; narrow-width reflow was checked above.
  await page.setViewportSize({ width: 320, height: 1200 })
  await saved.scrollIntoViewIfNeeded()
  await page.evaluate(() => globalThis.scrollTo(0, globalThis.scrollY))
  await saved.screenshot({ path: testInfo.outputPath('saved-mapping-mobile.png') })
  await saved.getByRole('checkbox').check()
  await saved.getByRole('button', { name: 'Revoke mapping for Fixture title 1' }).click()
  await expect(saved.getByRole('status')).toContainText('Mapping revoked')
  expect(approvals).toBe(1); expect(revocations).toBe(1)
})
