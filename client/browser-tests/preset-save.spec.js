/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@playwright/test'
import { mockModalCallers } from './support/modalCallerFixtures.js'

async function mockReceipts(page, onComplete) {
  let active = null, sequence = 0
  await page.route('**/api/presets/custom/save-requests**', async route => {
    const path = new globalThis.URL(route.request().url()).pathname
    if (route.request().method() === 'GET') return route.fulfill({ json: { request: active } })
    if (path.endsWith('/save-requests')) {
      if (active) return route.fulfill({ status: 409, json: { error: 'Check previous save' } })
      active = { requestId: `efb9b919-5d23-4778-b731-${String(++sequence).padStart(12, '0')}`,
        state: 'pending', resolved: false, presetId: null }
      return route.fulfill({ status: 201, json: active })
    }
    if (path.endsWith('/complete')) {
      const result = await onComplete(route)
      if (result.saved) active = { ...active, state: 'saved', presetId: 42 }
      return route.fulfill({ status: result.status, json: result.status === 200 ? active : { error: 'Private validation detail' } })
    }
    expect(path).toContain('/resolve')
    const resolved = { ...active, state: active.state === 'pending' ? 'cancelled' : 'saved', resolved: true }
    active = null
    return route.fulfill({ json: resolved })
  })
}

async function openCreate(page) {
  await page.goto('/browser-tests/fixtures/modal-callers.html')
  await page.getByRole('tab', { name: 'My Presets', exact: true }).click()
  await page.getByRole('button', { name: 'Create New Preset' }).click()
  return page.getByRole('dialog', { name: 'Create Custom Preset', exact: true })
}

test('real preset form stays busy, preserves a rejected draft and allows one explicit retry', async ({ page }) => {
  const unexpected = await mockModalCallers(page)
  const release = Promise.withResolvers()
  let attempts = 0
  await mockReceipts(page, async route => {
    expect(route.request().method()).toBe('POST')
    expect(route.request().postDataJSON().name).toBe('Family draft')
    attempts++
    if (attempts === 1) {
      await release.promise
      return { status: 400, saved: false }
    }
    return { status: 200, saved: true }
  })
  const dialog = await openCreate(page)
  await dialog.getByLabel('Name *', { exact: true }).fill('Family draft')
  await dialog.getByRole('button', { name: 'Create Preset', exact: true }).click()
  await expect(dialog.getByRole('status').filter({ hasText: 'Saving preset…' })).toHaveText('Saving preset…')
  await expect(dialog.getByLabel('Name *', { exact: true })).toBeDisabled()
  await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeDisabled()
  await expect(dialog.getByRole('button', { name: 'Create Preset', exact: true })).toBeDisabled()
  await page.keyboard.press('Escape')
  await expect(dialog.getByRole('button', { name: 'Close Create Custom Preset', exact: true })).toBeDisabled()
  await expect(dialog).toBeVisible()
  expect(attempts).toBe(1)
  release.resolve()
  await expect(dialog.getByRole('alert')).toHaveText('Could not confirm the save. Check save status before trying again.')
  await expect(dialog).not.toContainText('Private validation detail')
  await expect(dialog.getByLabel('Name *', { exact: true })).toHaveValue('Family draft')
  await dialog.getByRole('button', { name: 'Check save status', exact: true }).click()
  await expect(dialog.getByLabel('Name *', { exact: true })).toBeEnabled()
  await dialog.getByRole('button', { name: 'Create Preset', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Create New Preset' })).toBeFocused()
  expect(attempts).toBe(2)
  expect(unexpected).toEqual([])
})

test('uncertain save is never automatically replayed and review shows the committed preset', async ({ page }) => {
  const unexpected = await mockModalCallers(page)
  await page.clock.install()
  let attempts = 0
  await page.route('**/api/presets/custom', route => {
    expect(route.request().method()).toBe('GET')
    return route.fulfill({ json: attempts ? [
      { id: 42, name: 'Saved despite lost response', category: 'custom', signals: {} },
    ] : [] })
  })
  await mockReceipts(page, route => {
    expect(route.request().method()).toBe('POST')
    attempts++
    return { status: 503, saved: true }
  })
  const dialog = await openCreate(page)
  await dialog.getByLabel('Name *', { exact: true }).fill('Saved despite lost response')
  await dialog.getByRole('button', { name: 'Create Preset', exact: true }).click()
  await expect(dialog.getByRole('alert')).toHaveText('Could not confirm the save. Check save status before trying again.')
  await page.clock.fastForward(10_000)
  expect(attempts).toBe(1)
  await expect(dialog.getByRole('button', { name: 'Create Preset', exact: true })).toHaveCount(0)
  await expect(dialog.getByLabel('Name *', { exact: true })).toBeDisabled()
  await page.reload()
  await expect(page.getByText('A previous save needs checking before you create another preset.')).toBeVisible()
  await page.getByRole('button', { name: 'Check save status', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByText('Saved despite lost response', { exact: true })).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: 'Preset saved.' })).toHaveText('Preset saved.')
  expect(attempts).toBe(1)
  expect(unexpected).toEqual([])
})

test('real edit form sends one update and closes on acknowledgement', async ({ page }) => {
  const unexpected = await mockModalCallers(page)
  await page.route('**/api/presets/custom', route => {
    expect(route.request().method()).toBe('GET')
    return route.fulfill({ json: [{ id: 9, name: 'Family Remix', category: 'custom', signals: {} }] })
  })
  let attempts = 0
  await page.route('**/api/presets/custom/9', route => {
    expect(route.request().method()).toBe('PUT')
    expect(route.request().postDataJSON().name).toBe('Edited remix')
    attempts++
    return route.fulfill({ json: { id: 9 } })
  })
  await page.goto('/browser-tests/fixtures/modal-callers.html')
  await page.getByRole('tab', { name: 'My Presets', exact: true }).click()
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Edit Custom Preset' })
  await dialog.getByLabel('Name *', { exact: true }).fill('Edited remix')
  await dialog.getByRole('button', { name: 'Update Preset', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(attempts).toBe(1)
  expect(unexpected).toEqual([])
})
