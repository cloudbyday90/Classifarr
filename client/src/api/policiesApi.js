/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { apiClient, getDataRequest } from './core'
import {
  buildNativePolicyCreateRequestOptions,
  createNativePolicyCreateIdempotencyKey,
  isNativePolicyCreatePayload,
} from '@/utils/policyNativeCreateIdempotency'
import {
  buildNativeIntentChangeRequestOptions,
  createNativeIntentChangeIdempotencyKey,
} from '@/utils/policyNativeIntentChangeIdempotency'
import {
  normalizePolicyAuthoringProposalAdjustmentCommands,
} from '@/utils/policyAuthoringProposalAdjustment'

export function getPolicy(id) {
  return getDataRequest(`/policies/${id}`)
}

export function getPolicies() {
  return getDataRequest('/policies')
}

export function getPolicyOperatorWorkflow(libraryId) {
  return getDataRequest(`/policies/operator-workflow/libraries/${libraryId}`)
}

export function getPolicyAuthoringLifecycle(libraryId) {
  return getDataRequest(`/policies/operator-workflow/libraries/${libraryId}/authoring-lifecycle`)
}

export function preparePolicyAuthoringProposal(libraryId) {
  return apiClient.post(`/policies/operator-workflow/libraries/${libraryId}/proposals`, {})
}

/**
 * Admits the server-prepared proposal reference and revision. The server
 * accepts only bounded genre-narrowing commands and reconstructs the declared
 * intent against the current proposal before creating a policy.
 *
 * @param {number} libraryId
 * @param {string} proposalReference
 * @param {string} proposalRevision
 * @param {{ idempotencyKey?: string, adjustmentCommands?: Array }} [options]
 */
export function admitPolicyAuthoringProposal(
  libraryId,
  proposalReference,
  proposalRevision,
  { idempotencyKey, adjustmentCommands = [] } = {}
) {
  const normalizedAdjustmentCommands = normalizePolicyAuthoringProposalAdjustmentCommands(adjustmentCommands)
  if (normalizedAdjustmentCommands === null) {
    throw new TypeError('Policy authoring proposal adjustment commands are invalid.')
  }
  const requestIdempotencyKey = idempotencyKey || createNativePolicyCreateIdempotencyKey()

  return apiClient.post(
    `/policies/operator-workflow/libraries/${libraryId}/proposals/${proposalReference}/admission`,
    {
      proposal_revision: proposalRevision,
      adjustment_commands: normalizedAdjustmentCommands.map(command => ({
        command_id: command.commandId,
        values: command.values,
      })),
    },
    buildNativePolicyCreateRequestOptions(requestIdempotencyKey)
  )
}

export function getPolicyNativeReadinessSummary(id) {
  return getDataRequest(`/policies/${id}/native-intent/readiness-summary`)
}

export function getPolicyNativeIntentPurposeChange(id) {
  return getDataRequest(`/policies/${id}/native-intent/purpose-change`)
}

export function getPolicyNativeIntentChangeRecentReceipt(id) {
  return getDataRequest(`/policies/${id}/native-intent/change-receipts/recent`)
}

export function preflightPolicyNativeIntentPurposeChange(id, expectedRevision, changeCommand) {
  return apiClient.post(`/policies/${id}/native-intent/changes/purpose-coverage/preflight`, {
    expected_revision: expectedRevision,
    change_command: changeCommand,
  })
}

/**
 * @param {number} id
 * @param {number} expectedRevision
 * @param {Record<string, unknown>} changeCommand
 * @param {{ idempotencyKey?: string }} [options]
 */
export function applyPolicyNativeIntentPurposeChange(
  id,
  expectedRevision,
  changeCommand,
  { idempotencyKey } = {}
) {
  const requestIdempotencyKey = idempotencyKey || createNativeIntentChangeIdempotencyKey()
  return apiClient.post(
    `/policies/${id}/native-intent/changes`,
    {
      expected_revision: expectedRevision,
      change_commands: [changeCommand],
    },
    buildNativeIntentChangeRequestOptions(requestIdempotencyKey)
  )
}

export function validatePolicyOperatorWorkflowCustomIntentSignal(libraryId, payload) {
  return apiClient.post(`/policies/operator-workflow/libraries/${libraryId}/intent-signals/custom`, payload)
}

/**
 * @param {Record<string, unknown>} data
 * @param {{ idempotencyKey?: string }} [options]
 */
export function createPolicy(data, { idempotencyKey } = {}) {
  if (!isNativePolicyCreatePayload(data)) {
    return apiClient.post('/policies', data)
  }

  const requestIdempotencyKey = idempotencyKey || createNativePolicyCreateIdempotencyKey()
  return apiClient.post(
    '/policies',
    data,
    buildNativePolicyCreateRequestOptions(requestIdempotencyKey)
  )
}

export function updatePolicy(id, data) {
  return apiClient.put(`/policies/${id}`, data)
}

export function deletePolicy(id) {
  return apiClient.delete(`/policies/${id}`)
}

export function getNativeIntentReconciliationStatus() {
  return getDataRequest('/policies/native-intent-reconciliation/status')
}

export function getNativeIntentReconciliationRemediationInventory() {
  return getDataRequest('/policies/native-intent-reconciliation/remediation')
}

export function getPolicyPurposeCoverageReview() {
  return getDataRequest('/policies/native-intent-reconciliation/purpose-coverage')
}

export function getPolicyNativeIntentReconciliationPurposeSuggestion(id) {
  return getDataRequest(`/policies/${id}/native-intent-reconciliation/purpose-suggestion`)
}

export function preflightPolicyPurposeCoverage(id, draft) {
  return apiClient.post(`/policies/${id}/native-intent/purpose-coverage/preflight`, {
    policy_intent_draft: draft,
  })
}

export function simulatePolicyCohort(id, draft) {
  return apiClient.post(`/policies/${id}/native-intent/cohort-simulation`, {
    policy_intent_draft: draft,
  })
}

const policiesApi = {
  getPolicy,
  getPolicies,
  getPolicyOperatorWorkflow,
  getPolicyAuthoringLifecycle,
  preparePolicyAuthoringProposal,
  admitPolicyAuthoringProposal,
  getPolicyNativeReadinessSummary,
  getPolicyNativeIntentPurposeChange,
  getPolicyNativeIntentChangeRecentReceipt,
  preflightPolicyNativeIntentPurposeChange,
  applyPolicyNativeIntentPurposeChange,
  validatePolicyOperatorWorkflowCustomIntentSignal,
  createPolicy,
  updatePolicy,
  deletePolicy,
  getNativeIntentReconciliationStatus,
  getNativeIntentReconciliationRemediationInventory,
  getPolicyPurposeCoverageReview,
  getPolicyNativeIntentReconciliationPurposeSuggestion,
  preflightPolicyPurposeCoverage,
  simulatePolicyCohort,
}

export default policiesApi
