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

const existingPolicyLifecycle = {
  version: 'policy.authoring_proposal.v1',
  statusId: 'existing_native_policy',
  library: { id: 7, name: 'Movies', mediaType: 'movie' },
  action: { id: 'inspect_policy', available: true },
  policy: { id: 12, libraryId: 7, name: 'Movies Policy' },
  proposal: { available: false, reasonId: 'existing_policy' },
}

const existingPolicyRead = {
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
    destinationProposal: { statusId: 'existing_policy', title: 'Movies Policy', available: false },
    nextAction: { kind: 'owner_action', ownerId: 'NATIVE_POLICY_SUMMARY', message: 'Policy is active' },
  },
}

function fulfillJson(route, body, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
}

async function mockExistingPolicy(page) {
  await page.route('**/api/setup/status', route => fulfillJson(route, { setupRequired: false }))
  await page.route('**/api/auth/me', route => fulfillJson(route, { id: 1, username: 'Admin' }))
  await page.route('**/api/user/me', route => fulfillJson(route, { id: 1, username: 'Admin' }))
  await page.route(/\/api\/notifications\/unread-count(?:\?.*)?$/, route => fulfillJson(route, { unread: 0 }))
  await page.route(/\/api\/notifications(?:\?.*)?$/, route => fulfillJson(route, { data: [] }))
  await page.route('**/api/system/health', route => fulfillJson(route, HEALTHY_SYSTEM_RESPONSE))
  await page.route('**/api/libraries', route => fulfillJson(route, [library]))
  await page.route('**/api/policies/operator-workflow/libraries/7/authoring-lifecycle', route => fulfillJson(route, existingPolicyLifecycle))
  await page.route('**/api/policies/operator-workflow/libraries/7', route => fulfillJson(route, existingPolicyRead))
  await page.route('**/api/policies/12/native-intent/readiness-summary', route => fulfillJson(route, {
    version: 'policy.native_readiness_summary.v1',
    statusId: 'available',
    policyId: 12,
    nativeIntent: { authorityStateId: 'single_active_native_intent', authoritative: true, intentVersion: 3, purposeRuleCount: 2, validationStateId: 'valid' },
    readiness: { stateId: 'ready', label: 'Ready', ready: true, nextAction: null },
  }))
}

test('an existing native policy shows its summary instead of a create flow', async ({ page }) => {
  await mockExistingPolicy(page)
  await page.goto('/policies?library=7')

  await expect(page.getByText('Movies Policy')).toBeVisible()
  await expect(page.getByRole('button', { name: /Create policy/ })).not.toBeVisible()
})
