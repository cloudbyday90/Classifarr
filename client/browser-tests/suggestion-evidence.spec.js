/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect } from '@playwright/test'

const suggestion = {
  id: 7, status: 'pending', suggestion_type: 'adjust_threshold',
  suggestion_config: { threshold_type: 'auto_classify', current: 85, recommended: 90 },
  confidence: 90, impact_estimate: 'Increase precision', policy_name: 'Movies', evidence_count: 22,
}

async function mockSuggestionRequests(page, role, readEvidence) {
  const reads = []
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const url = new globalThis.URL(route.request().url())
    const path = url.pathname
    let data = {}
    let status = 200
    if (path === '/api/setup/status') data = { setupRequired: false }
    if (path === '/api/auth/me' || path === '/api/user/me') data = { id: 1, role, username: 'reviewer' }
    if (['/api/libraries', '/api/policies', '/api/notifications', '/api/notifications/active'].includes(path)) data = []
    if (path === '/api/notifications/unread-count') data = { unread: 0 }
    if (path === '/api/suggestions') data = [suggestion]
    if (path.startsWith('/api/suggestions/')) {
      reads.push(`${path}${url.search}`)
      if (path === '/api/suggestions/7/evidence') ({ data, status } = await readEvidence(url.searchParams.get('afterPosition')))
    }
    await route.fulfill({ status, json: data })
  })
  return reads
}

test('administrator pages once per activation with the same focus at the end', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 })
  const nextPage = Promise.withResolvers()
  const reads = await mockSuggestionRequests(page, 'admin', async after => {
    if (after) {
      await nextPage.promise
      return { status: 200, data: { suggestionId: 7, referenceCount: 22, nextAfterPosition: null,
        items: [{ position: 21, status: 'unavailable' }, { position: 22, status: 'available', title: 'Last title', wasCorrection: false }] } }
    }
    return { status: 200, data: { suggestionId: 7, referenceCount: 22, nextAfterPosition: 20,
      items: Array.from({ length: 20 }, (_, index) => ({ position: index + 1, status: 'available',
        title: index === 0 ? '<img src=x>' : `Title ${index + 1}`, wasCorrection: null, selectedLibrary: 'Movies' })) } }
  })
  try {
    await page.goto('/tuning-suggestions')
    const opener = page.getByRole('button', { name: 'View Details' })
    await opener.press('Enter')
    const dialog = page.getByRole('dialog', { name: 'Suggestion Details' })
    const status = dialog.getByRole('status')
    await expect(dialog.getByRole('heading', { name: 'Suggestion Details' })).toBeFocused()
    await expect(status).toHaveText('Evidence references 1–20 of 22.')
    await expect(dialog.getByText('<img src=x>', { exact: true })).toBeVisible()
    await expect(dialog.locator('img')).toHaveCount(0)
    expect(reads).toEqual(['/api/suggestions/7/evidence'])

    const next = dialog.getByRole('button', { name: 'Next page' })
    await next.press('Enter')
    await expect(status).toHaveText('Loading supporting evidence…')
    await expect(next).toBeFocused()
    await next.press('Enter')
    nextPage.resolve()
    await expect(status).toHaveText('Evidence references 21–22 of 22. 1 unavailable.')
    await expect(dialog.getByText('Evidence reference 21 is unavailable.')).toBeVisible()
    await expect(dialog.getByText('No correction recorded')).toBeVisible()
    await expect(dialog.getByText('Title 20', { exact: true })).toHaveCount(0)
    await expect(next).toBeFocused()
    await expect(next).toBeDisabled()
    await next.press('Enter')
    expect(reads).toEqual(['/api/suggestions/7/evidence', '/api/suggestions/7/evidence?afterPosition=20'])

    const fits = await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)
    expect(fits).toBe(true)
    await next.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(opener).toBeFocused()
  } finally {
    nextPage.resolve()
  }
})

test('a member can inspect the proposal when supporting evidence is refused', async ({ page }) => {
  const reads = await mockSuggestionRequests(page, 'user', () => ({ status: 403, data: { error: 'Admin access required' } }))
  await page.goto('/tuning-suggestions')
  await page.getByRole('button', { name: 'View Details' }).press('Enter')
  const dialog = page.getByRole('dialog', { name: 'Suggestion Details' })
  await expect(dialog.getByText('Increase precision')).toBeVisible()
  await expect(dialog.getByText('"recommended": 90', { exact: false })).toBeVisible()
  await expect(dialog.getByRole('status')).toHaveText('Only administrators can view supporting evidence.')
  await expect(dialog.getByRole('button', { name: 'Next page' })).toHaveCount(0)
  expect(reads).toEqual(['/api/suggestions/7/evidence'])
})
