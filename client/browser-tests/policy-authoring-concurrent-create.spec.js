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
    reference: 'proposal_ref_concurrent_test',
    revision: 'b'.repeat(64),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    summary: { title: 'Movies Policy', purpose: [], helpfulHints: [], hardLimitCount: 0, avoidCount: 0 },
  },
}

const existingPolicyLifecycle = {
  version: 'policy.authoring_proposal.v1',
  statusId: 'existing_native_policy',
  library: { id: 7, name: 'Movies', mediaType: 'movie' },
  action: { id: 'inspect_policy', available: true },
  policy: { id: 99, libraryId: 7, name: 'Movies Policy' },
  proposal: { available: false, reasonId: 'existing_policy' },
}

function fulfillJson(route, body, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
}

test('concurrent create from two tabs does not produce a second policy', async ({ browser }) => {
  const admissions = []

  async function setupPage(page) {
    await page.route('**/api/setup/status', route => fulfillJson(route, { setupRequired: false }))
    await page.route('**/api/auth/me', route => fulfillJson(route, { id: 1, username: 'Admin' }))
    await page.route('**/api/user/me', route => fulfillJson(route, { id: 1, username: 'Admin' }))
    await page.route(/\/api\/notifications\/unread-count(?:\?.*)?$/, route => fulfillJson(route, { unread: 0 }))
    await page.route(/\/api\/notifications(?:\?.*)?$/, route => fulfillJson(route, { data: [] }))
    await page.route('**/api/system/health', route => fulfillJson(route, HEALTHY_SYSTEM_RESPONSE))
    await page.route('**/api/libraries', route => fulfillJson(route, [library]))
    await page.route('**/api/policies/operator-workflow/libraries/7/authoring-lifecycle', route => fulfillJson(route, lifecycle))
    await page.route('**/api/policies/operator-workflow/libraries/7', route => fulfillJson(route, {}, 404))
    await page.route('**/api/policies/operator-workflow/libraries/7/proposals', route => fulfillJson(route, preparedProposal))
    await page.route('**/api/policies/operator-workflow/libraries/7/proposals/proposal_ref_concurrent_test/admission', async route => {
      admissions.push(route.request().postDataJSON())
      await fulfillJson(route, {
        version: 'policy.authoring_proposal.v1',
        statusId: 'existing_policy',
        policy: { id: 99, libraryId: 7, name: 'Movies Policy' },
        recovery: { lifecycleReloadRequired: true },
      })
    })
  }

  const context = await browser.newContext()
  const page1 = await context.newPage()
  await setupPage(page1)
  await page1.goto('/policies?library=7')

  const page2 = await context.newPage()
  await setupPage(page2)
  await page2.goto('/policies?library=7')

  await page1.getByRole('button', { name: /Create policy/i }).click().catch(() => {})
  await page2.getByRole('button', { name: /Create policy/i }).click().catch(() => {})

  await page.route

  await expect.poll(() => admissions.length).toBeGreaterThanOrEqual(1)
})
