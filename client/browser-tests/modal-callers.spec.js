/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@playwright/test'
import { mockModalCallers } from './support/modalCallerFixtures.js'

test('preset deletion failure stays inside the active modal and supports retry', async ({ page }) => {
  const unexpected = await mockModalCallers(page)
  await page.route('**/api/presets/custom', route => route.fulfill({ json: [
    { id: 9, name: 'Family Remix', category: 'custom', signals: {} },
  ] }))
  let attempts = 0
  await page.route('**/api/presets/custom/9', route => {
    expect(route.request().method()).toBe('DELETE')
    attempts++
    return route.fulfill({ status: 409, json: { error: 'Private upstream failure detail' } })
  })
  await page.goto('/browser-tests/fixtures/modal-callers.html')
  await page.getByRole('tab', { name: 'My Presets', exact: true }).click()
  await page.getByRole('button', { name: 'Delete preset Family Remix' }).click()
  const dialog = page.getByRole('dialog', { name: 'Delete Custom Preset' })
  await dialog.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(dialog.getByRole('alert')).toHaveText('Could not delete this preset. Try again.')
  expect(await dialog.evaluate(element => element.matches(':modal'))).toBe(true)
  await expect(dialog).not.toContainText('Private upstream failure detail')
  await dialog.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(dialog.getByRole('alert')).toHaveText('Could not delete this preset. Try again.')
  expect(attempts).toBe(2)
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Delete preset Family Remix' })).toBeFocused()
  await page.getByRole('button', { name: 'Delete preset Family Remix' }).click()
  await expect(dialog.getByRole('alert')).toHaveCount(0)
  expect(unexpected).toEqual([])
})

test('real preset summary hands off to customization and returns to search', async ({ page }) => {
  const unexpected = await mockModalCallers(page)
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/browser-tests/fixtures/modal-callers.html')
  await page.getByRole('button', { name: 'View Details' }).click()
  const summary = page.getByRole('dialog', { name: 'Family Friendly', exact: true })
  await expect(summary.locator('h3').first()).toBeFocused()
  await summary.getByRole('button', { name: /Customize/ }).click()
  const form = page.getByRole('dialog', { name: 'Family Friendly (Custom Preset)', exact: true })
  await expect(form.locator('h3').first()).toBeFocused()
  expect(await form.evaluate(element => element.matches(':modal'))).toBe(true)
  await expect(summary).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(page.locator('#preset-search')).toBeFocused()
  await expect(page.locator('dialog:modal')).toHaveCount(0)
  expect(unexpected).toEqual([])
  expect(errors).toEqual([])
})

for (const rejected of [false, true]) {
  test(`real policy mapping navigation ${rejected ? 'preserves modal on guard rejection' : 'releases modal and focuses library mapping'}`, async ({ page }) => {
    const unexpected = await mockModalCallers(page)
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(`/browser-tests/fixtures/modal-callers.html${rejected ? '?reject' : ''}`)
    await page.getByRole('button', { name: 'Open policy builder' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: 'Open library mapping', exact: true }).click()
    if (rejected) {
      await expect(dialog.getByRole('alert')).toContainText('Classifarr could not open the library mapping')
      expect(await dialog.evaluate(element => element.matches(':modal'))).toBe(true)
      await page.keyboard.press('Escape')
      await expect(page.getByRole('button', { name: 'Open policy builder' })).toBeFocused()
    } else {
      await expect(page.locator('#library-arr-mapping')).toBeFocused()
      await expect(dialog).toHaveCount(0)
      const priority = page.getByRole('spinbutton', { name: 'Priority' })
      await priority.fill('2')
      await expect(priority).toHaveValue('2')
    }
    expect(unexpected).toEqual([])
    expect(errors).toEqual([])
  })
}
