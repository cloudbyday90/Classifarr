/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { expect, test } from '@playwright/test'

const HEALTHY_SYSTEM_RESPONSE = {
  database: 'healthy',
  mediaServer: 'healthy',
  radarr: 'healthy',
  sonarr: 'healthy',
  ollama: 'healthy',
  imageEmbeddings: 'healthy',
  tmdb: 'healthy',
  omdb: 'healthy',
  discordBot: 'healthy',
  tavily: 'healthy',
  queueWorker: 'healthy',
  details: {},
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
    reference: 'proposal_reference_123456789012345678',
    revision: 'a'.repeat(64),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    adjustment: {
      purposeGenres: [
        { value: 'Animation', sourceId: 'current_library_profile' },
        { value: 'Family', sourceId: 'current_library_profile' },
      ],
      helpfulStudios: [
        { value: 'Studio Example', sourceId: 'current_library_profile' },
        { value: 'Studio Second', sourceId: 'current_library_profile' },
      ],
    },
    summary: {
      title: 'Movies Policy',
      purpose: [{ signalType: 'genres', operator: 'any_of', values: ['Animation', 'Family'] }],
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

async function mockPolicyAuthoring(page, onAdmission) {
  await page.route('**/api/setup/status', route => fulfillJson(route, { setupRequired: false }))
  await page.route('**/api/auth/me', route => fulfillJson(route, { id: 1, username: 'Admin' }))
  await page.route('**/api/user/me', route => fulfillJson(route, { id: 1, username: 'Admin' }))
  await page.route(/\/api\/notifications\/unread-count(?:\?.*)?$/, route => (
    fulfillJson(route, { unread: 0 })
  ))
  await page.route(/\/api\/notifications(?:\?.*)?$/, route => fulfillJson(route, { data: [] }))
  await page.route('**/api/system/health', route => fulfillJson(route, HEALTHY_SYSTEM_RESPONSE))
  await page.route('**/api/libraries', route => fulfillJson(route, [library]))
  await page.route('**/api/policies/operator-workflow/libraries/7/authoring-lifecycle', route => fulfillJson(route, lifecycle))
  await page.route('**/api/policies/operator-workflow/libraries/7', route => fulfillJson(route, {}, 404))
  await page.route('**/api/policies/operator-workflow/libraries/7/proposals', route => fulfillJson(route, preparedProposal))
  await page.route('**/api/policies/operator-workflow/libraries/7/proposals/proposal_reference_123456789012345678/admission', async route => {
    await onAdmission(route.request().postDataJSON())
    await fulfillJson(route, {
      version: 'policy.authoring_proposal.v1',
      statusId: 'proposal_admission_created',
      policy: { id: 12, libraryId: 7, name: 'Movies Policy' },
      recovery: { lifecycleReloadRequired: false },
    })
  })
}

test('supports keyboard adjustment of both eligible groups without losing their native semantics', async ({ page }) => {
  let admissionPayload = null
  await mockPolicyAuthoring(page, payload => {
    admissionPayload = payload
  })

  await page.goto('/policies?library=7')

  const adjustmentToggle = page.getByRole('button', { name: /Adjust this policy|Hide adjustments/ })
  await expect(adjustmentToggle).toHaveAttribute('aria-expanded', 'false')
  await adjustmentToggle.focus()
  await page.keyboard.press('Enter')

  await expect(adjustmentToggle).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByRole('group', { name: 'Keep these proposed genres' })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Keep these helpful studios' })).toBeVisible()

  await page.keyboard.press('Tab')
  const animation = page.getByRole('checkbox', { name: /Animation/ })
  await expect(animation).toBeFocused()
  await page.keyboard.press('Space')
  await expect(animation).not.toBeChecked()

  await page.keyboard.press('Tab')
  const studioExample = page.getByRole('checkbox', { name: /Studio Example/ })
  await expect(studioExample).toBeFocused()
  await page.keyboard.press('Space')
  await expect(studioExample).not.toBeChecked()

  await page.getByRole('button', { name: 'Create policy' }).click()
  await expect.poll(() => admissionPayload).not.toBeNull()
  expect(admissionPayload.adjustment_commands).toEqual([
    { command_id: 'set_purpose_genres', values: ['Family'] },
    { command_id: 'set_helpful_studios', values: ['Studio Second'] },
  ])
})
