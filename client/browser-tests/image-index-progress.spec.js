/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@playwright/test'

test('repair snapshot is readable, keyboard operable, responsive and read-only', async ({ page }, testInfo) => {
  let writes = 0, reads = 0, denied = false
  let status = 'waiting', reason = 'cooldown'
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const path = new globalThis.URL(route.request().url()).pathname
    if (route.request().method() !== 'GET') writes++
    let data = {}, code = 200
    if (path === '/api/setup/status') data = { setupRequired: false }
    if (['/api/auth/me', '/api/user/me'].includes(path)) data = { id: 1, role: 'admin', username: 'fixture-operator' }
    if (path === '/api/notifications') data = { data: [] }
    if (path === '/api/notifications/active') data = []
    if (path === '/api/notifications/unread-count') data = { unread: 0 }
    if (path === '/api/system/status') data = { version: 'fixture', uptime: 100, memoryUsage: { heapUsed: 1000 } }
    if (path === '/api/stats/image-index-progress') {
      reads++
      code = denied ? 403 : 200
      data = { status, reason, observedAt: '2026-10-01T12:00:00Z',
        automatic: { started: 1, limit: 3, nextEligibleAt: '2026-10-01T13:00:00Z' },
        indexes: [{ key: 'idx_embeddings_image_hnsw', status: 'invalid' },
          { key: 'idx_embeddings_image_present', status: 'verified' }, { key: 'idx_embeddings_image_hash', status: 'verified' }],
      }
    }
    await route.fulfill({ status: code, contentType: 'application/json', body: JSON.stringify(data) })
  })
  await page.goto('/system')
  const card = page.getByRole('region', { name: 'Image search maintenance' })
  await expect(card).toContainText('2 of 3 indexes verified')
  await expect(card.getByRole('status')).toContainText('Waiting')
  await expect(card.getByRole('listitem')).toHaveCount(3)
  await card.screenshot({ path: testInfo.outputPath('repair-desktop.png') })
  const refresh = card.getByRole('button', { name: 'Refresh repair status' })
  status = 'running'; reason = 'validating'
  await refresh.focus(); await page.keyboard.press('Enter')
  await expect(card.getByRole('status')).toContainText('Running')
  await expect(refresh).toBeFocused()
  expect(reads).toBe(2)
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 }); await card.scrollIntoViewIfNeeded()
    const bounds = await card.boundingBox()
    expect(bounds.x).toBeGreaterThanOrEqual(0)
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width)
    expect(await card.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
    await card.screenshot({ path: testInfo.outputPath(`repair-${width}.png`) })
  }
  denied = true
  await refresh.click()
  await expect(card).toContainText('Administrator access is required')
  await expect(card.getByRole('listitem')).toHaveCount(0)
  expect(writes).toBe(0)
})
