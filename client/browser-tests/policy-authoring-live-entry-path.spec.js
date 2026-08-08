/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { expect, test } from '@playwright/test'

const HEALTHY_SYSTEM_RESPONSE = {
  database: 'healthy', mediaServer: 'healthy', radarr: 'healthy', sonarr: 'healthy',
  ollama: 'healthy', imageEmbeddings: 'healthy', tmdb: 'healthy', omdb: 'healthy',
  discordBot: 'healthy', tavily: 'healthy', queueWorker: 'healthy', details: {},
}

const library = { id: 7, name: 'Movies', media_type: 'movie' }
const lifecycle = {
  version: 'policy.authoring_proposal.v1',
  statusId: 'eligible_to_prepare_proposal',
  library: { id: 7, name: 'Movies', mediaType: 'movie' },
  action: { id: 'prepare_proposal', available: true },
  policy: null,
  proposal: { available: true, reasonId: 'current_profile_candidate_available' },
}
const preparedProposal = {
  version: 'policy.authoring_proposal.v1',
  statusId: 'proposal_prepared',
  lifecycle,
  proposal: {
    reference: 'proposal_reference_live_entry_path',
    revision: 'd'.repeat(64),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    adjustment: {
      purposeGenres: [{ value: 'Animation', sourceId: 'current_library_profile' }],
      helpfulStudios: [],
    },
    summary: {
      title: 'Movies Policy',
      purpose: [{ signalType: 'genres', operator: 'any_of', values: ['Animation'] }],
      helpfulHints: [],
      hardLimitCount: 0,
      avoidCount: 0,
    },
  },
}

function fulfillJson(route, body, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  })
}

async function mockLiveEntryPath(page, onAdmission = async () => {}) {
  await page.route('**/api/setup/status', route => fulfillJson(route, { setupRequired: false }))
  await page.route('**/api/auth/me', route => fulfillJson(route, { id: 1, username: 'Admin' }))
  await page.route('**/api/user/me', route => fulfillJson(route, { id: 1, username: 'Admin' }))
  await page.route(/\/api\/notifications\/unread-count(?:\?.*)?$/, route => (
    fulfillJson(route, { unread: 0 })
  ))
  await page.route(/\/api\/notifications(?:\?.*)?$/, route => fulfillJson(route, { data: [] }))
  await page.route('**/api/system/health', route => fulfillJson(route, HEALTHY_SYSTEM_RESPONSE))
  await page.route('**/api/libraries', route => fulfillJson(route, [library]))
  await page.route('**/api/policies/operator-workflow/libraries/7/authoring-lifecycle', route => (
    fulfillJson(route, lifecycle)
  ))
  await page.route('**/api/policies/operator-workflow/libraries/7', route => (
    fulfillJson(route, {}, 404)
  ))
  await page.route('**/api/policies/operator-workflow/libraries/7/proposals', route => (
    fulfillJson(route, preparedProposal)
  ))
  await page.route(
    '**/api/policies/operator-workflow/libraries/7/proposals/proposal_reference_live_entry_path/admission',
    async route => {
      await onAdmission(route.request().postDataJSON())
      await fulfillJson(route, {
        version: 'policy.authoring_proposal.v1',
        statusId: 'proposal_admission_created',
        policy: { id: 12, libraryId: 7, name: 'Movies Policy' },
        recovery: { lifecycleReloadRequired: false },
      })
    }
  )
}

test('the lifecycle list leads by keyboard to one admitted policy-create action', async ({ page }) => {
  const admissions = []
  await mockLiveEntryPath(page, payload => {
    admissions.push(payload)
  })

  await page.goto('/policies')

  await expect(page.getByRole('heading', { name: 'Library Policy Setup' })).toBeVisible()
  const reviewProposal = page.getByRole('button', { name: 'Review destination proposal' })
  await expect(reviewProposal).toBeVisible()
  await reviewProposal.focus()
  await page.keyboard.press('Enter')

  await expect(page).toHaveURL(/\/policies\?library=7$/)
  await expect(page.locator('#policy-authoring-selection-7')).toBeFocused()
  const createPolicy = page.getByRole('button', { name: 'Create policy', exact: true })
  await expect(createPolicy).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Configure', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Reset policy/i })).toHaveCount(0)

  await createPolicy.click()

  await expect.poll(() => admissions.length).toBe(1)
  expect(admissions[0]).toEqual(expect.objectContaining({
    proposal_revision: 'd'.repeat(64),
    adjustment_commands: [],
  }))
  await expect(page.getByText('Policy created: Movies Policy')).toBeVisible()
})

test('the retired advanced-settings hash does not expose a normal authoring target', async ({ page }) => {
  await mockLiveEntryPath(page)

  await page.goto('/policies#policy-builder-advanced-settings')

  await expect(page.getByRole('heading', { name: 'Library Policy Setup' })).toBeVisible()
  await expect(page.locator('#policy-builder-advanced-settings')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Review destination proposal' })).toBeVisible()
})
