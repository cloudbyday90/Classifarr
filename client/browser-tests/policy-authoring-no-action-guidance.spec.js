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

const library = { id: 9, name: 'Special Collection', media_type: 'movie' }

const blockedLifecycle = {
  version: 'policy.authoring_proposal.v1',
  statusId: 'safely_blocked',
  library: { id: 9, name: 'Special Collection', mediaType: 'movie' },
  action: { id: 'resolve_blocker', available: false },
  policy: null,
  proposal: { available: false, reasonId: 'blocked_by_maintenance' },
}

const blockedWorkflowRead = {
  version: 'policy.operator_workflow_read.v4',
  statusId: 'ready',
  library,
  workflow: {
    version: 'policy.operator_workflow.v1',
    sections: [],
    readiness: { stateId: 'ready', ready: true, label: 'Ready', nextAction: null },
  },
  presentation: {
    version: 'policy.authoring_workflow_presentation.v1',
    destinationProposal: { statusId: 'blocked', title: 'Special Collection', available: false },
    nextAction: { kind: 'owner_action', ownerId: 'MAINTENANCE', message: 'This library requires maintenance attention.' },
  },
}

function fulfillJson(route, body, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
}

async function mockNoActionGuidance(page) {
  await page.route('**/api/setup/status', route => fulfillJson(route, { setupRequired: false }))
  await page.route('**/api/auth/me', route => fulfillJson(route, { id: 1, username: 'Admin' }))
  await page.route('**/api/user/me', route => fulfillJson(route, { id: 1, username: 'Admin' }))
  await page.route(/\/api\/notifications\/unread-count(?:\?.*)?$/, route => fulfillJson(route, { unread: 0 }))
  await page.route(/\/api\/notifications(?:\?.*)?$/, route => fulfillJson(route, { data: [] }))
  await page.route('**/api/system/health', route => fulfillJson(route, HEALTHY_SYSTEM_RESPONSE))
  await page.route('**/api/libraries', route => fulfillJson(route, [library]))
  await page.route('**/api/policies/operator-workflow/libraries/9/authoring-lifecycle', route => fulfillJson(route, blockedLifecycle))
  await page.route('**/api/policies/operator-workflow/libraries/9', route => fulfillJson(route, blockedWorkflowRead))
}

test('a blocked library shows bounded guidance without dead controls', async ({ page }) => {
  await mockNoActionGuidance(page)
  await page.goto('/policies?library=9')

  await expect(page.getByText(/Special Collection/i)).toBeVisible({ timeout: 10000 })
  await expect(page.getByRole('button', { name: /Create policy/i })).not.toBeVisible()
  await expect(page.getByText(/maintenance/i)).toBeVisible()
})
