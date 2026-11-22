/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@playwright/test'
import { URL } from 'node:url'

test('Command Center retries adjacent large History IDs as separate items', async ({ page }) => {
  const ids = ['9007199254740992', '9007199254740993']
  let requests = 0
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const { pathname } = new URL(route.request().url())
    let data = {}
    if (pathname === '/api/setup/status') data = { setupRequired: false }
    if (['/api/auth/me', '/api/user/me'].includes(pathname)) data = { id: 1, role: 'admin', username: 'fixture-operator' }
    if (pathname === '/api/notifications') data = { data: [] }
    if (pathname === '/api/notifications/unread-count') data = { unread: 0 }
    if (['/api/classification/progress', '/api/queue/pending', '/api/queue/failed', '/api/libraries'].includes(pathname)) data = []
    if (pathname === '/api/classification/pending') {
      data = { items: requests ? [] : ids.map((id, index) => ({ id, title: `Synthetic retry ${index}`, media_type: 'movie' })) }
    }
    if (pathname === '/api/classification/retry') {
      expect(route.request().method()).toBe('POST')
      expect(route.request().postDataJSON()).toEqual({ classificationIds: ids, options: {} })
      requests++
      data = { success: true, queued: 2, skipped: 0, failed: 0 }
    }
    await route.fulfill({ json: data })
  })

  await page.goto('/')
  const retry = page.getByRole('button', { name: 'Retry Classification All', exact: true })
  await retry.click()
  await expect.poll(() => requests).toBe(1)
  await expect(retry).toHaveCount(0)
})

test('recovery banner is read-only, responsive, keyboard accessible and clears stale guidance', async ({ page }, testInfo) => {
  let writes = 0, reads = 0, denied = false
  let libraries = [
    { id: 5, name: 'SYNTHETIC TEST — Movies', media_type: 'movie', is_active: true,
      ingestion_status: { state: 'legacy_owner_unknown', recoveryMode: 'deployment_required', recoveryDiagnostic: {
        migration: '20261005_180000_ingestion_compatibility_fence.sql', migrationRecorded: true, protocolReady: true,
        checks: [{ table: 'media_server_items', trigger: 'ingestion_compatibility_rows', status: 'not_always_enabled' }],
      } } },
    { id: 6, name: 'Family', media_type: 'tv', is_active: true,
      ingestion_status: { state: 'legacy_owner_unknown', recoveryMode: 'automatic' } },
  ]
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const path = new URL(route.request().url()).pathname
    if (route.request().method() !== 'GET') writes++
    let data = {}, status = 200
    if (path === '/api/setup/status') data = { setupRequired: false }
    if (['/api/auth/me', '/api/user/me'].includes(path)) data = { id: 1, role: 'admin', username: 'fixture-operator' }
    if (path === '/api/notifications') data = { data: [] }
    if (path === '/api/notifications/unread-count') data = { unread: 0 }
    if (['/api/classification/progress', '/api/queue/pending', '/api/queue/failed'].includes(path)) data = []
    if (path === '/api/libraries') { reads++; data = libraries; if (denied) status = 403 }
    if (path === '/api/queue/live-stats') data = { queue: { pending: 0 }, health: { ai: true, worker: true } }
    if (path === '/api/classification/pending') data = { items: [] }
    if (path === '/api/reclassification/batches/activity') data = { batches: [], nextCursor: null }
    if (path.includes('native-intent-reconciliation') || path.includes('held-out-semantic')) status = 403
    await route.fulfill({ status, contentType: 'application/json', headers: { 'Cache-Control': 'no-store' }, body: JSON.stringify(data) })
  })
  await page.goto('/')
  const banner = page.getByRole('region', { name: '1 library needs attention' })
  await expect(banner).toBeVisible()
  await expect(banner).toContainText('Automatic recovery queued')
  await expect(banner.getByRole('link', { name: /Open library\s*:\s*SYNTHETIC TEST — Movies/ })).toHaveAttribute('href', '/libraries/5')
  await expect(banner.getByRole('link', { name: /View import\s*:\s*Family/ })).toHaveAttribute('href', '/libraries/6')
  await expect(banner.locator('.deployment-guidance details p').first()).not.toBeVisible()
  await banner.getByText('What Classifarr checked', { exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(banner).toContainText('media_server_items / ingestion_compatibility_rows: not enabled for all writes')
  await banner.screenshot({ path: testInfo.outputPath('recovery-desktop.png') })
  await page.keyboard.press('Enter')
  await expect(banner.locator('.deployment-guidance details p').first()).not.toBeVisible()
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 })
    await expect.poll(() => page.locator('aside').evaluate(element => element.getBoundingClientRect().right)).toBeLessThanOrEqual(0)
    expect(await banner.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
  }
  await banner.screenshot({ path: testInfo.outputPath('recovery-mobile.png') })
  const refresh = banner.getByRole('button', { name: 'Refresh status' })
  await refresh.focus()
  await page.keyboard.press('Enter')
  await expect.poll(() => reads).toBeGreaterThan(1)
  await expect(refresh).toBeFocused()
  denied = true
  await refresh.click()
  const unavailable = page.getByRole('region', { name: 'Library status unavailable' })
  await expect(unavailable).toBeVisible()
  await expect(unavailable.getByRole('link')).toHaveCount(0)
  await expect(unavailable).not.toContainText('Movies')
  denied = false
  libraries = []
  await unavailable.getByRole('button', { name: 'Refresh status' }).click()
  await expect(page.locator('.recovery-banner')).toHaveCount(0)
  await expect(page.getByRole('status').filter({ hasText: 'No library import issues reported.' })).toHaveCount(1)
  await expect(page.getByRole('status').filter({ hasText: 'No library import issues reported.' })).toBeFocused()
  expect(await page.evaluate(() => globalThis.localStorage.getItem('classifarr:v1:swr:command-center:libraries'))).toBeNull()
  expect(writes).toBe(0)
})

test('saved retry refusal detail works with the keyboard in a narrow Queue card', async ({ page }) => {
  const refused = { task_type: 'classification', status: 'failed', error_message: 'task_retry_lineage_refused' }
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const path = new URL(route.request().url()).pathname
    let data = {}
    if (path === '/api/setup/status') data = { setupRequired: false }
    if (['/api/auth/me', '/api/user/me'].includes(path)) data = { id: 1, role: 'admin', username: 'fixture-operator' }
    if (['/api/classification/progress', '/api/queue/pending', '/api/libraries'].includes(path)) data = []
    if (path === '/api/queue/failed') data = [
      { ...refused, id: 1, payload: { title: 'Recorded retry' }, retry_lineage_refusal_category: 'webhook_links' },
      { ...refused, id: 2, payload: { title: 'Older retry' } },
      { ...refused, id: 3, payload: { title: 'Saved replacement' }, retry_lineage_replacement_saved: true },
    ]
    if (path === '/api/classification/pending') data = { items: [] }
    if (path === '/api/notifications') data = { data: [] }
    await route.fulfill({ json: data })
  })
  await page.goto('/')
  await page.setViewportSize({ width: 320, height: 844 })
  const section = page.locator('#errors')
  const toggle = section.getByRole('button', { name: /Errors/ })
  const summary = section.getByText('Why this stopped', { exact: true })
  const recordedSummary = section.locator('article').filter({ hasText: 'Recorded retry' }).locator('summary')
  const savedSummary = section.locator('article').filter({ hasText: 'Saved replacement' }).locator('summary')
  const explanation = section.getByText('Classifarr could not verify the original webhook links during this retry.')
  const savedReplacement = section.getByText('Classifarr saved the local replacement. Routing remains unverified for this task.')
  await expect(summary).toHaveCount(2)
  await toggle.focus()
  await page.keyboard.press('Enter')
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(recordedSummary).toBeHidden()
  await expect(savedSummary).toBeHidden()
  await page.keyboard.press('Space')
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await expect(explanation).toBeHidden()
  await recordedSummary.focus()
  await page.keyboard.press('Enter')
  await expect(explanation).toBeVisible()
  await expect(recordedSummary).toBeFocused()
  await expect(savedReplacement).toBeHidden()
  await savedSummary.focus()
  await page.keyboard.press('Enter')
  await expect(savedReplacement).toBeVisible()
  await expect(savedSummary).toBeFocused()
  await expect(section.getByRole('button', { name: 'Retry', exact: true })).toHaveCount(0)
  await expect(section.getByRole('button', { name: 'Dismiss', exact: true })).toHaveCount(3)
  expect(await section.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
})
