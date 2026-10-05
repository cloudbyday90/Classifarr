/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect } from '@playwright/test'
import { URL } from 'node:url'
test('synthetic safeguard repair requires review, confirms once, and restores focus', async ({ page }, testInfo) => {
  let writes = 0, previews = 0, repaired = false
  const library = () => ({ id: 5, name: 'SYNTHETIC TEST — Movies', media_type: 'movie', is_active: true, rules: [],
    ingestion_status: repaired ? { state: 'complete' } : { state: 'legacy_owner_unknown', recoveryMode: 'deployment_required' } })
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const path = new URL(route.request().url()).pathname, method = route.request().method()
    let data = {}, status = 200
    if (path === '/api/setup/status') data = { setupRequired: false }
    if (['/api/auth/me', '/api/user/me'].includes(path)) data = { id: 1, role: 'admin', username: 'synthetic-operator' }
    if (path === '/api/libraries/5') data = library()
    if (path === '/api/libraries') data = [library()]
    if (path === '/api/notifications') data = { data: [] }
    if (path === '/api/notifications/unread-count') data = { unread: 0 }
    if (path === '/api/libraries/ingestion-safeguards') {
      if (method === 'GET') { previews++; data = repaired ? { reason: 'not_needed' } : { reason: 'confirmation_required', token: 'synthetic-plan', changes: [{ table: 'media_server_items', trigger: 'ingestion_compatibility_rows' }] } }
      else {
        writes++; expect(route.request().postDataJSON()).toEqual({ token: 'synthetic-plan', confirm: true })
        repaired = true; data = { status: 'repaired', backup: { id: 'synthetic-backup' } }
      }
    } else if (method !== 'GET') throw new Error('Unexpected fixture mutation')
    if (path.includes('/arr') || path.includes('/rules') || path.includes('/patterns')) data = []
    if (path.includes('native-intent-reconciliation') || path.includes('held-out-semantic')) status = 403
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) })
  })
  await page.goto('/libraries/5')
  const section = page.getByRole('region', { name: 'Repair import safeguards' })
  await expect(section).toBeVisible()
  expect(previews).toBe(0); expect(writes).toBe(0)
  await section.getByRole('button', { name: 'Check repair options' }).click()
  await expect(section).toContainText('all libraries in this database')
  const apply = section.getByRole('button', { name: 'Back up and repair' })
  await expect(apply).toHaveAttribute('aria-disabled', 'true')
  await apply.focus(); await page.keyboard.press('Enter'); expect(writes).toBe(0)
  await section.getByRole('checkbox').focus(); await page.keyboard.press('Space')
  await apply.focus()
  await page.keyboard.press('Enter')
  await expect(section).toContainText('Backup synthetic-backup is retained')
  await expect(section.getByRole('button', { name: 'Check repair options' })).toBeFocused()
  expect(writes).toBe(1)
  await page.setViewportSize({ width: 390, height: 844 })
  await expect.poll(() => page.locator('aside').evaluate(element => element.getBoundingClientRect().right)).toBeLessThanOrEqual(0)
  expect(await section.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
  await section.screenshot({ path: testInfo.outputPath('synthetic-repair-result.png') })
})
