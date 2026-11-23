/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect } from '@playwright/test'

const suggestion = {
  id: 7, policy_id: 2, status: 'pending', suggestion_type: 'adjust_threshold',
  confidence: 90, impact_estimate: 'Increase precision', policy_name: 'Movies', library_name: 'Movies',
}
const proposal = { ...suggestion, proposal_status: 'available', reference_count: 22,
  suggestion_config: { threshold_type: 'auto_classify', current: 85, recommended: 90 } }
const firstRequest = '/api/suggestions/page?status=pending'

async function mockSuggestionRequests(page, role, readEvidence, {
  readPage = () => ({ items: [suggestion], nextBeforeId: null }),
  readProposal = () => ({ status: 200, data: proposal }),
  reject = () => ({ status: 500, data: {} }),
} = {}) {
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
    if (path === '/api/suggestions' || path.startsWith('/api/suggestions/')) {
      reads.push(`${path}${url.search}`)
      status = 404
      if (path === '/api/suggestions/page') {
        status = 200
        data = await readPage(url.searchParams)
      } else if (/^\/api\/suggestions\/\d+\/proposal$/.test(path)) {
        ({ data, status } = await readProposal(Number(path.split('/')[3])))
      } else if (/^\/api\/suggestions\/\d+\/evidence$/.test(path)) {
        ({ data, status } = await readEvidence(url.searchParams.get('afterPosition')))
      } else if (path === '/api/suggestions/7/reject' && route.request().method() === 'POST') {
        ({ data, status } = await reject(route.request().postDataJSON()))
      }
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
    await expect(opener).toBeVisible()
    expect(reads).toEqual([firstRequest])
    await opener.press('Enter')
    const dialog = page.getByRole('dialog', { name: 'Suggestion Details' })
    const status = dialog.getByRole('region', { name: 'Supporting Evidence' }).getByRole('status')
    await expect(dialog.getByRole('heading', { name: 'Suggestion Details' })).toBeFocused()
    await expect(status).toHaveText('Evidence references 1–20 of 22.')
    await expect(dialog.getByText('<img src=x>', { exact: true })).toBeVisible()
    await expect(dialog.locator('img')).toHaveCount(0)
    await expect(dialog.getByRole('button', { name: 'Apply Suggestion' })).toBeVisible()
    expect(reads.slice(1).sort()).toEqual(['/api/suggestions/7/evidence', '/api/suggestions/7/proposal'])

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
    expect(reads).toHaveLength(4)
    expect(reads.at(-1)).toBe('/api/suggestions/7/evidence?afterPosition=20')

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
  await expect(dialog.getByText('Recommended percentage', { exact: true })).toBeVisible()
  await expect(dialog.getByText('90', { exact: true })).toBeVisible()
  await expect(dialog.getByRole('region', { name: 'Supporting Evidence' }).getByRole('status'))
    .toHaveText('Only administrators can view supporting evidence.')
  await expect(dialog.getByRole('button', { name: 'Apply Suggestion' })).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: 'Reject', exact: true })).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: 'Next page' })).toHaveCount(0)
  expect(reads.slice(1).sort()).toEqual(['/api/suggestions/7/evidence', '/api/suggestions/7/proposal'])
})

test('All follows live pages by keyboard and retains focus at the endpoint', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 })
  const olderPage = Promise.withResolvers()
  const summaries = Array.from({ length: 20 }, (_, index) => ({ ...suggestion, id: 27 - index,
    status: index === 0 ? 'superseded' : 'pending' }))
  const reads = await mockSuggestionRequests(page, 'admin', () => ({ status: 404, data: {} }), {
    readPage: async filters => {
      if (filters.get('status') === 'pending') return { items: [suggestion], nextBeforeId: null }
      if (!filters.has('beforeId')) return { items: summaries, nextBeforeId: 8 }
      await olderPage.promise
      return { items: [{ ...suggestion, status: 'rejected' }], nextBeforeId: null }
    },
  })
  try {
    await page.goto('/tuning-suggestions')
    const status = page.getByRole('main').getByRole('status')
    await expect(status).toHaveText('Page 1. 1 suggestion on this page.')
    await page.getByLabel('Suggestion status').selectOption('all')
    await expect(status).toHaveText('Page 1. 20 suggestions on this page.')
    const older = page.getByRole('button', { name: 'Older' })
    await older.press('Enter')
    await expect(status).toHaveText('Loading suggestions…')
    await expect(older).toBeFocused()
    await older.press('Enter')
    olderPage.resolve()
    await expect(status).toHaveText('Page 2. 1 suggestion on this page.')
    await expect(older).toBeFocused()
    await expect(older).toBeDisabled()
    await expect(page.getByRole('article')).toHaveCount(1)
    await expect(page.getByRole('article').getByText('Rejected', { exact: true })).toBeVisible()
    const newer = page.getByRole('button', { name: 'Newer' })
    await newer.press('Enter')
    await expect(status).toHaveText('Page 1. 20 suggestions on this page.')
    await expect(newer).toBeFocused()
    expect(reads).toEqual([firstRequest, '/api/suggestions/page?status=all',
      '/api/suggestions/page?status=all&beforeId=8', '/api/suggestions/page?status=all'])
    const fits = await page.locator('html').evaluate(element => element.scrollWidth <= element.clientWidth)
    expect(fits).toBe(true)
  } finally {
    olderPage.resolve()
  }
})

test('an unavailable proposal can be rejected with keyboard focus restored', async ({ page }) => {
  const reasons = []
  const reads = await mockSuggestionRequests(page, 'admin', () => ({ status: 200, data: {
    suggestionId: 7, referenceCount: 0, items: [], nextAfterPosition: null,
  } }), {
    readPage: () => ({ items: reasons.length ? [] : [suggestion], nextBeforeId: null }),
    readProposal: () => ({ status: 200, data: { ...proposal, proposal_status: 'unavailable', suggestion_config: null } }),
    reject: body => { reasons.push(body.reason); return { status: 200, data: { success: true } } },
  })
  await page.goto('/tuning-suggestions')
  const opener = page.getByRole('button', { name: 'View Details' })
  const details = page.getByRole('dialog', { name: 'Suggestion Details' })
  const rejection = page.getByRole('dialog', { name: 'Reject Suggestion' })
  await opener.press('Enter')
  await expect(details.getByText('This saved proposal cannot be displayed.')).toBeVisible()
  await expect(details.getByRole('button', { name: 'Apply Suggestion' })).toHaveCount(0)
  await details.getByRole('button', { name: 'Reject', exact: true }).press('Enter')
  await expect(rejection.getByRole('heading')).toBeFocused()
  await rejection.getByRole('heading').press('Escape')
  await expect(opener).toBeFocused()
  await opener.press('Enter')
  await details.getByRole('button', { name: 'Reject', exact: true }).press('Enter')
  await rejection.getByLabel('Reason for rejection (optional)').fill('Outdated advice')
  await rejection.getByRole('button', { name: 'Reject Suggestion', exact: true }).press('Enter')
  await expect(page.getByText('No suggestions found.')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Policy Tuning Suggestions' })).toBeFocused()
  expect(reasons).toEqual(['Outdated advice'])
  expect(reads.slice(-2)).toEqual(['/api/suggestions/7/reject', firstRequest])
})

test('closing a loading proposal keeps its response out of the next dialog', async ({ page }) => {
  const firstProposal = Promise.withResolvers()
  const other = { ...suggestion, id: 6, policy_id: 3, policy_name: 'Series' }
  const reads = await mockSuggestionRequests(page, 'admin', () => ({ status: 404, data: {} }), {
    readPage: () => ({ items: [suggestion, other], nextBeforeId: null }),
    readProposal: async id => {
      if (id === suggestion.id) {
        await firstProposal.promise
        return { status: 200, data: proposal }
      }
      return { status: 200, data: { ...proposal, ...other, status: 'applied',
        suggestion_config: { ...proposal.suggestion_config, recommended: 95 } } }
    },
  })
  try {
    await page.goto('/tuning-suggestions')
    const details = page.getByRole('dialog', { name: 'Suggestion Details' })
    const cardForPolicy = policy => page.getByRole('article').filter({ has: page.getByRole('heading', { name: policy }) })
    await cardForPolicy('adjust threshold · Movies').getByRole('button', { name: 'View Details' }).press('Enter')
    await expect(details.getByText('Loading proposal…')).toBeVisible()
    await expect.poll(() => reads.includes('/api/suggestions/7/proposal')).toBe(true)
    await details.getByRole('heading', { name: 'Suggestion Details' }).press('Escape')
    await cardForPolicy('adjust threshold · Series').getByRole('button', { name: 'View Details' }).press('Enter')
    await expect(details.getByText('95', { exact: true })).toBeVisible()
    const received = page.waitForResponse(response => response.url().endsWith('/api/suggestions/7/proposal'))
    firstProposal.resolve()
    await received
    await expect(details.getByText('95', { exact: true })).toBeVisible()
    await expect(details.getByText('90', { exact: true })).toHaveCount(0)
    await expect(details.getByRole('button', { name: 'Apply Suggestion' })).toHaveCount(0)
    await expect(details.getByRole('button', { name: 'Reject', exact: true })).toHaveCount(0)
  } finally {
    firstProposal.resolve()
  }
})
