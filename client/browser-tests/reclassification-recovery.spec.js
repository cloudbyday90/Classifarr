/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@playwright/test'

test('history and batch show recovered moves without resuming a paused batch', async ({ page }, testInfo) => {
  let recovered = false
  const writes = []
  const item = { id: 101, title: 'Synthetic movie', year: 2026, media_type: 'movie',
    library_id: 1, library_name: 'Movies A', method: 'ai_analysis', confidence: 45,
    created_at: '2026-09-24T00:00:00Z', metadata: {} }
  const recovery = () => ({ operationId: '00000000-0000-4000-8000-000000000001', state: recovered ? 'completed' : 'moving' })
  const batch = () => ({ id: 1, status: 'paused', error_message: 'Original dependency unavailable',
    items: [{ ...item, status: recovered ? 'completed' : 'failed', move_recovery: recovery() }],
    progress: { total: 1, completed: recovered ? 1 : 0, failed: recovered ? 0 : 1, skipped: 0, percentage: recovered ? 100 : 0 } })
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const path = new globalThis.URL(route.request().url()).pathname
    if (route.request().method() !== 'GET') writes.push(path)
    let data = {}
    if (path === '/api/setup/status') data = { setupRequired: false }
    if (path === '/api/auth/me' || path === '/api/user/me') data = { id: 1, role: 'admin', username: 'operator' }
    if (path === '/api/notifications') data = { data: [] }
    if (path === '/api/notifications/active') data = []
    if (path === '/api/notifications/unread-count') data = { unread: 0 }
    if (path === '/api/system/health') data = { ollama: 'healthy' }
    if (path === '/api/libraries') data = [
      { id: 1, name: 'Movies A', media_type: 'movie', is_active: true },
      { id: 2, name: 'Movies B', media_type: 'movie', is_active: true },
    ]
    if (path === '/api/classification/history') data = { data: [{ ...item, move_recovery: recovery() }],
      pagination: { page: 1, totalPages: 1, total: 1 } }
    if (path === '/api/reclassification/batch') data = { id: 1 }
    if (path === '/api/reclassification/batch/1/validate') data = { id: 1, status: 'validated', items: [{ ...item, status: 'validated' }] }
    if (path === '/api/reclassification/batch/1/execute' || path === '/api/reclassification/batch/1') data = batch()
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) })
  })
  await page.goto('/history')
  await expect(page.getByText('Move verification pending')).toBeVisible()
  await page.locator('tbody input[type=checkbox]').check()
  await page.getByRole('button', { name: /Reclassify|Move Selected/i }).click()
  await page.getByRole('dialog').locator('select').selectOption('2')
  await page.getByRole('button', { name: 'Validate & Continue' }).click()
  await page.getByRole('button', { name: 'Execute 1 Items' }).click()
  await expect(page.getByText('Execution Paused')).toBeVisible()
  recovered = true
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('Move completed and verified')).toBeVisible()
  await expect(dialog.getByRole('status')).toHaveText('1 completed, 0 failed.')
  await expect(dialog.getByText(/there is nothing left to resume/)).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Resume', exact: true })).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Retry', exact: true })).toHaveCount(0)
  await dialog.getByText('Move recovery reference', { exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(dialog.getByText('00000000-0000-4000-8000-000000000001')).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('recovered-batch.png') })
  expect(writes).toEqual(['/api/reclassification/batch', '/api/reclassification/batch/1/validate', '/api/reclassification/batch/1/execute'])
})
