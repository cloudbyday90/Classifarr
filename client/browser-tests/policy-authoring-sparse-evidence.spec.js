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

const library = { id: 8, name: 'New Library', media_type: 'movie' }

const sparseLifecycle = {
  version: 'policy.authoring_proposal.v1',
  statusId: 'eligible_to_prepare_proposal',
  library: { id: 8, name: 'New Library', mediaType: 'movie' },
  action: { id: 'prepare_proposal', available: true },
  policy: null,
  proposal: { available: false, reasonId: 'insufficient_profile' },
}

const sparseWorkflowRead = {
  version: 'policy.operator_workflow_read.v4',
  statusId: 'ready',
  library,
  workflow: {
    version: 'policy.operator_workflow.v1',
    sections: [],
    readiness: { stateId: 'needs_more_examples', ready: false, label: 'Needs more examples', nextAction: null },
  },
  presentation: {
    version: 'policy.authoring_workflow_presentation.v1',
    destinationProposal: { statusId: 'sparse_evidence', title: 'New Library', available: false },
    nextAction: { kind: 'owner_action', ownerId: 'INTENT_SIGNAL_PICKER', message: 'Add what belongs here' },
  },
  emptyStateProjection: { stateId: 'sparse_evidence', message: 'This library has limited content. Describe what belongs here.' },
}

function fulfillJson(route, body, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
}

async function mockSparseLibrary(page) {
  await page.route('**/api/setup/status', route => fulfillJson(route, { setupRequired: false }))
  await page.route('**/api/auth/me', route => fulfillJson(route, { id: 1, username: 'Admin' }))
  await page.route('**/api/user/me', route => fulfillJson(route, { id: 1, username: 'Admin' }))
  await page.route(/\/api\/notifications\/unread-count(?:\?.*)?$/, route => fulfillJson(route, { unread: 0 }))
  await page.route(/\/api\/notifications(?:\?.*)?$/, route => fulfillJson(route, { data: [] }))
  await page.route('**/api/system/health', route => fulfillJson(route, HEALTHY_SYSTEM_RESPONSE))
  await page.route('**/api/libraries', route => fulfillJson(route, [library]))
  await page.route('**/api/policies/operator-workflow/libraries/8/authoring-lifecycle', route => fulfillJson(route, sparseLifecycle))
  await page.route('**/api/policies/operator-workflow/libraries/8', route => fulfillJson(route, sparseWorkflowRead))
}

test('a sparse library shows declared-intent guidance instead of a failure', async ({ page }) => {
  await mockSparseLibrary(page)
  await page.goto('/policies?library=8')

  await expect(page.getByText(/New Library/i)).toBeVisible()
  await expect(page.getByText(/limited content|belongs here/i)).toBeVisible()
  await expect(page.getByText(/error|failed|unavailable/i)).not.toBeVisible()
})
