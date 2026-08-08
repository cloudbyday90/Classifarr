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

const staleLifecycle = {
  version: 'policy.authoring_proposal.v1',
  statusId: 'proposal_stale',
  library: { id: 7, name: 'Movies', mediaType: 'movie' },
  action: { id: 'prepare_proposal', available: true },
  policy: null,
  proposal: { available: false, reasonId: 'proposal_revision_changed' },
}

function fulfillJson(route, body, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
}

async function mockStaleProposal(page) {
  await page.route('**/api/setup/status', route => fulfillJson(route, { setupRequired: false }))
  await page.route('**/api/auth/me', route => fulfillJson(route, { id: 1, username: 'Admin' }))
  await page.route('**/api/user/me', route => fulfillJson(route, { id: 1, username: 'Admin' }))
  await page.route(/\/api\/notifications\/unread-count(?:\?.*)?$/, route => fulfillJson(route, { unread: 0 }))
  await page.route(/\/api\/notifications(?:\?.*)?$/, route => fulfillJson(route, { data: [] }))
  await page.route('**/api/system/health', route => fulfillJson(route, HEALTHY_SYSTEM_RESPONSE))
  await page.route('**/api/libraries', route => fulfillJson(route, [library]))
  await page.route('**/api/policies/operator-workflow/libraries/7/authoring-lifecycle', route => fulfillJson(route, staleLifecycle))
  await page.route('**/api/policies/operator-workflow/libraries/7', route => fulfillJson(route, {}, 404))
  await page.route('**/api/policies/operator-workflow/libraries/7/proposals', route => fulfillJson(route, {
    version: 'policy.authoring_proposal.v1',
    statusId: 'proposal_stale',
    lifecycle: staleLifecycle,
  }))
}

test('a stale proposal shows recovery guidance without a blind retry', async ({ page }) => {
  await mockStaleProposal(page)
  await page.goto('/policies?library=7')

  await expect(page.getByText(/stale|changed|reload/i)).toBeVisible({ timeout: 10000 })
  await expect(page.getByRole('button', { name: /Create policy/i })).not.toBeVisible()
})
