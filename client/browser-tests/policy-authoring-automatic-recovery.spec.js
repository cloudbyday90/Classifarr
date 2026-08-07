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

const recoveryLifecycle = {
  version: 'policy.authoring_proposal.v1',
  statusId: 'profile_recovery_required',
  library: { id: 7, name: 'Movies', mediaType: 'movie' },
  action: { id: 'await_recovery', available: false },
  policy: null,
  proposal: { available: false, reasonId: 'profile_recovery_in_progress' },
}

const recoveryWorkflowRead = {
  version: 'policy.operator_workflow_read.v4',
  statusId: 'profile_needs_refresh',
  library,
  workflow: {
    version: 'policy.operator_workflow.v1',
    sections: [],
    readiness: { stateId: 'stale_profile', ready: false, label: 'Profile is being refreshed', nextAction: null },
  },
  presentation: {
    version: 'policy.authoring_workflow_presentation.v1',
    destinationProposal: { statusId: 'recovery_in_progress', title: 'Movies', available: false },
    recovery: { statusId: 'automated', message: 'Profile evidence is being refreshed automatically.' },
    nextAction: { kind: 'automated_guidance', message: 'Profile evidence is being refreshed automatically.' },
  },
}

function fulfillJson(route, body, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
}

async function mockAutomaticRecovery(page) {
  await page.route('**/api/setup/status', route => fulfillJson(route, { setupRequired: false }))
  await page.route('**/api/auth/me', route => fulfillJson(route, { id: 1, username: 'Admin' }))
  await page.route('**/api/user/me', route => fulfillJson(route, { id: 1, username: 'Admin' }))
  await page.route(/\/api\/notifications\/unread-count(?:\?.*)?$/, route => fulfillJson(route, { unread: 0 }))
  await page.route(/\/api\/notifications(?:\?.*)?$/, route => fulfillJson(route, { data: [] }))
  await page.route('**/api/system/health', route => fulfillJson(route, HEALTHY_SYSTEM_RESPONSE))
  await page.route('**/api/libraries', route => fulfillJson(route, [library]))
  await page.route('**/api/policies/operator-workflow/libraries/7/authoring-lifecycle', route => fulfillJson(route, recoveryLifecycle))
  await page.route('**/api/policies/operator-workflow/libraries/7', route => fulfillJson(route, recoveryWorkflowRead))
}

test('automatic profile recovery is informational and does not create a maintainer workflow', async ({ page }) => {
  await mockAutomaticRecovery(page)
  await page.goto('/policies?library=7')

  await expect(page.getByText(/refresh|recover/i)).toBeVisible({ timeout: 10000 })
  await expect(page.getByRole('button', { name: /Refresh|Retry|Reset|Sync/i })).not.toBeVisible()
  await expect(page.getByRole('button', { name: /Create policy/i })).not.toBeVisible()
})
