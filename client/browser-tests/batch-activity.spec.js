/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@playwright/test'
import { URL } from 'node:url'

test('Command Center rediscovers and controls saved batches after reload', async ({ page }, testInfo) => {
  let status = 'paused'
  const writes = []
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const path = new URL(route.request().url()).pathname
    if (route.request().method() !== 'GET') {
      writes.push(path)
      if (path.endsWith('/resume')) status = 'executing'
      if (path.endsWith('/pause')) status = 'paused'
      if (path.endsWith('/cancel')) status = 'cancelled'
    }
    const batch = { id: 42, status, items: [{ id: 9, title: 'Synthetic TV show', media_type: 'tv', status: 'executing',
      move_recovery: { operationId: '00000000-0000-4000-8000-000000000042', state: 'moving' } }],
    progress: { total: 3, completed: 1, failed: 0, skipped: 0, cancelled: 0, percentage: 33 } }
    let data = {}
    if (path === '/api/setup/status') data = { setupRequired: false }
    if (['/api/auth/me', '/api/user/me'].includes(path)) data = { id: 1, role: 'admin', username: 'operator' }
    if (path === '/api/notifications') data = { data: [] }
    if (path === '/api/notifications/unread-count') data = { unread: 0 }
    if (['/api/libraries', '/api/classification/progress', '/api/queue/pending', '/api/queue/failed', '/api/notifications/active'].includes(path)) data = []
    if (path === '/api/queue/live-stats') data = { queue: {}, health: { ai: true, worker: true } }
    if (path === '/api/reclassification/batches/activity') data = {
      batches: [{ id: 42, status, total: 3, completed: 1, failed: 0, skipped: 0, cancelled: 0, recovering: 1, attention: 0 }], nextCursor: null,
    }
    if (path.startsWith('/api/reclassification/batch/42')) data = batch
    await route.fulfill({ status: path.endsWith('/resume') ? 202 : 200, contentType: 'application/json', body: JSON.stringify(data) })
  })

  await page.goto('/')
  await page.reload()
  const panel = page.locator('details.batch-activity')
  await panel.locator('summary').focus()
  await page.keyboard.press('Enter')
  await expect(panel.getByText('Batch #42 · Paused')).toBeVisible()
  expect(writes).toEqual([])
  const manage = panel.getByRole('button', { name: 'View batch 42' })
  await manage.focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('Execution Paused')).toBeVisible()
  await expect(dialog.getByText('Synthetic TV show')).toBeVisible()
  await expect(dialog.getByText('Move verification pending')).toBeVisible()
  expect(writes).toEqual([])
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
  await expect(manage).toBeFocused()

  await manage.press('Enter')
  await dialog.getByRole('button', { name: 'Resume', exact: true }).click()
  await expect(dialog.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
  await dialog.getByRole('button', { name: 'Pause', exact: true }).click()
  await expect(dialog.getByText('Execution Paused')).toBeVisible()
  await dialog.getByRole('button', { name: 'Cancel Remaining' }).click()
  await expect(dialog.getByText('Batch Finished with Issues')).toBeVisible()
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(panel.getByText('Batch #42 · Cancelled')).toBeVisible()
  expect(writes).toEqual(['/api/reclassification/batch/42/resume', '/api/reclassification/batch/42/pause', '/api/reclassification/batch/42/cancel'])
  expect(await page.evaluate(() => globalThis.localStorage.getItem('classifarr:v1:swr:batch-activity'))).toBeNull()
  await expect(dialog).toHaveCount(0)
  await panel.screenshot({ path: testInfo.outputPath('batch-activity-desktop.png'), animations: 'disabled' })
  await page.setViewportSize({ width: 390, height: 844 })
  await expect.poll(() => page.locator('aside').evaluate(element => element.getBoundingClientRect().right)).toBeLessThanOrEqual(0)
  await panel.scrollIntoViewIfNeeded()
  const bounds = await panel.boundingBox()
  expect(bounds.x).toBeGreaterThanOrEqual(0)
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(390)
  expect(await panel.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
  await panel.screenshot({ path: testInfo.outputPath('batch-activity-mobile.png'), animations: 'disabled' })
})
