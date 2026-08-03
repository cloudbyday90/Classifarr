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

export function getPolicyNativeReadinessSummary(id) {
  return getDataRequest(`/policies/${id}/native-intent/readiness-summary`)
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

const policiesApi = {
  getPolicy,
  getPolicies,
  getPolicyOperatorWorkflow,
  getPolicyAuthoringLifecycle,
  getPolicyNativeReadinessSummary,
  validatePolicyOperatorWorkflowCustomIntentSignal,
  createPolicy,
  updatePolicy,
  deletePolicy,
  getNativeIntentReconciliationStatus,
}

export default policiesApi
