/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect } from '@playwright/test'

test('History routing controls send the exact BIGINT ID and announce their results', async ({ page }) => {
  const id = '9007199254740993'
  const base = `/api/queue/manual-routing/${id}`
  const actions = []
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const request = route.request()
    const path = new globalThis.URL(request.url()).pathname
    const method = request.method()
    let data = {}
    if (path === '/api/setup/status') data = { setupRequired: false }
    if (path === '/api/auth/me' || path === '/api/user/me') data = { id: 1, role: 'admin', username: 'reviewer' }
    if (['/api/libraries', '/api/notifications', '/api/notifications/active'].includes(path)) data = []
    if (path === '/api/notifications/unread-count') data = { unread: 0 }
    if (path === '/api/classification/history') {
      data = { data: [{ id, title: 'Synthetic routing check', year: 2026, tmdb_id: 42, media_type: 'movie',
        status: 'completed', method: 'manual_classification', confidence: 100, library_name: 'Movies',
        created_at: '2026-10-03T12:00:00.000Z', metadata: { classification_details: {
          routing: 'manual_routing_pending', manual_routing_intent: { version: 1 },
        } } }], pagination: { page: 1, totalPages: 1, total: 1 } }
    }
    if (path.startsWith('/api/queue/manual-routing/')) {
      const body = method === 'GET' ? null : request.postDataJSON()
      actions.push({ path, method, body })
      if (path === `${base}/background`) data = { enabled: method === 'POST', attempts: 0, lastResult: 'off' }
      if (path === `${base}/check`) data = { reason: 'not_present', recorded: true, message: 'Not found in the provider.' }
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) })
  })

  await page.goto('/history')
  await page.getByRole('button', { name: 'View details for Synthetic routing check', exact: true }).press('Enter')
  const check = page.getByRole('button', { name: 'Check routing', exact: true })
  await expect(check).toBeVisible()
  expect(actions).toEqual([])
  await check.press('Enter')
  await expect(page.getByRole('status').filter({ hasText: 'Not found in the provider.' })).toBeVisible()

  await page.getByText('Background routing checks', { exact: true }).press('Enter')
  await expect(page.getByText('Off · 0 of 3 checks used.', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: 'Enable checks for this item', exact: true }).press('Enter')
  await expect(page.getByRole('status').filter({ hasText: 'Background checks enabled for this item.' })).toBeVisible()
  expect(actions).toEqual([
    { path: `${base}/check`, method: 'POST', body: {} },
    { path: `${base}/background`, method: 'GET', body: null },
    { path: `${base}/background`, method: 'POST', body: { enabled: true } },
  ])
})
