/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { ref, unref, watch } from 'vue'
import { getPolicyNativeReadinessSummary } from '@/api/policiesApi'

const NATIVE_READINESS_SUMMARY_VERSION = 'policy.native_readiness_summary.v1'
const NATIVE_READINESS_SUMMARY_ERROR = 'Classifarr could not load the current policy readiness.'
const AVAILABLE_STATUS_ID = 'native_policy_readiness_available'
const READINESS_STATE_IDS = new Set([
  'ready',
  'needs_more_examples',
  'needs_operator_review',
  'needs_routing',
  'blocked_by_hard_limit',
  'stale_profile',
])
const PROFILE_RECOVERY_STATE_IDS = new Set([
  'not_required',
  'scheduled',
  'queued',
  'processing',
  'awaiting_automatic_probe',
])
const ALLOWED_STATUS_IDS = new Set([
  AVAILABLE_STATUS_ID,
  'native_policy_readiness_native_intent_unavailable',
])

function normalizePolicyId(value) {
  const policyId = Number(value)
  return Number.isInteger(policyId) && policyId > 0 ? policyId : null
}

function hasReadOnlyAuthority(authority = {}) {
  return authority?.displayProjection === true &&
    authority?.automationDecision === false &&
    authority?.policyPersistence === false &&
    authority?.routingExecution === false
}

function hasReadOnlySideEffects(sideEffects = {}) {
  return typeof sideEffects?.profileRefreshOutboxRead === 'boolean' &&
    typeof sideEffects?.profileRefreshCircuitRead === 'boolean' &&
    sideEffects?.liveMediaServerLookupPerformed === false &&
    sideEffects?.liveProviderLookupPerformed === false &&
    sideEffects?.providerQuotaRead === false &&
    sideEffects?.policyStorageMutated === false &&
    sideEffects?.routingExecuted === false
}

function hasBoundedReadiness(readiness = {}) {
  return READINESS_STATE_IDS.has(readiness?.stateId) &&
    typeof readiness?.label === 'string' &&
    typeof readiness?.ready === 'boolean' &&
    readiness.ready === (readiness.stateId === 'ready') &&
    typeof readiness?.nextAction?.actionId === 'string' &&
    typeof readiness?.nextAction?.label === 'string' &&
    Array.isArray(readiness?.reasonCodes)
}

function hasBoundedProfileRecovery(profileRecovery = {}) {
  return PROFILE_RECOVERY_STATE_IDS.has(profileRecovery?.stateId) &&
    typeof profileRecovery?.label === 'string' &&
    profileRecovery.label.length > 0 &&
    typeof profileRecovery?.message === 'string' &&
    profileRecovery.message.length > 0
}

function isNativeReadinessSummary(value, expectedPolicyId) {
  if (
    !value ||
    typeof value !== 'object' ||
    value.version !== NATIVE_READINESS_SUMMARY_VERSION ||
    normalizePolicyId(value.policyId) !== expectedPolicyId ||
    !ALLOWED_STATUS_IDS.has(value.statusId) ||
    !hasReadOnlyAuthority(value.authority) ||
    !hasReadOnlySideEffects(value.sideEffects) ||
    value.rawPayloadExposed !== false
  ) {
    return false
  }

  return value.statusId !== AVAILABLE_STATUS_ID || (
    hasBoundedReadiness(value.readiness) &&
    hasBoundedProfileRecovery(value.profileRecovery)
  )
}

export function usePolicyNativeReadinessSummary({
  loadSummaryRequest = getPolicyNativeReadinessSummary,
} = {}) {
  const readinessSummary = ref(null)
  const loading = ref(false)
  const error = ref('')
  let activeRequestId = 0

  const clearSummary = () => {
    activeRequestId += 1
    readinessSummary.value = null
    loading.value = false
    error.value = ''
  }

  const loadSummary = async (policyIdValue) => {
    const policyId = normalizePolicyId(policyIdValue)
    if (policyId === null) {
      clearSummary()
      return false
    }

    const requestId = activeRequestId + 1
    activeRequestId = requestId
    readinessSummary.value = null
    error.value = ''
    loading.value = true

    try {
      const result = await loadSummaryRequest(policyId)
      if (requestId !== activeRequestId) return false

      if (!isNativeReadinessSummary(result, policyId)) {
        error.value = NATIVE_READINESS_SUMMARY_ERROR
        return false
      }

      readinessSummary.value = result
      return true
    } catch {
      if (requestId === activeRequestId) {
        error.value = NATIVE_READINESS_SUMMARY_ERROR
      }
      return false
    } finally {
      if (requestId === activeRequestId) {
        loading.value = false
      }
    }
  }

  const watchSummary = policyIdSource => watch(
    () => unref(policyIdSource),
    loadSummary,
    { immediate: true }
  )

  return {
    readinessSummary,
    loading,
    error,
    clearSummary,
    loadSummary,
    watchSummary,
  }
}

export {
  NATIVE_READINESS_SUMMARY_ERROR,
  NATIVE_READINESS_SUMMARY_VERSION,
  hasBoundedProfileRecovery,
  isNativeReadinessSummary,
}
