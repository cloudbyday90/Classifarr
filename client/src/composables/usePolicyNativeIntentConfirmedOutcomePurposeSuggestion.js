/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { ref } from 'vue'
import {
  getPolicyNativeIntentConfirmedOutcomePurposeSuggestion,
} from '@/api/policiesApi'
import {
  cloneNativeIntentPurposeChangeRules,
} from '@/utils/policyNativeIntentPurposeChange'

const SUGGESTION_VERSION = 'policy.native_intent_confirmed_outcome_purpose_suggestion.v1'
const SUGGESTION_STATUS = 'native_intent_confirmed_outcome_purpose_suggestion_available'
const SUGGESTION_SOURCE = 'repeated_confirmed_outcomes'

function normalizePositiveInteger(value) {
  const numericValue = Number(value)
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null
}

function isConfirmedOutcomePurposeSuggestion(value, policyId) {
  const suggestion = value?.suggestion
  const confirmationCount = Number(suggestion?.confirmationCount)
  if (
    !value ||
    typeof value !== 'object' ||
    value.version !== SUGGESTION_VERSION ||
    value.statusId !== SUGGESTION_STATUS ||
    value.available !== true ||
    normalizePositiveInteger(value.policyId) !== policyId ||
    !normalizePositiveInteger(value.revision) ||
    value.authority?.source !== 'server_owned_native_intent' ||
    value.authority?.purposeChangeAllowed !== false ||
    value.authority?.browserAuthorityAccepted !== false ||
    value.rawOutcomeEvidenceExposed !== false ||
    value.rawLibraryContentExposed !== false ||
    value.compatibilityDataExposed !== false ||
    value.aiDataExposed !== false ||
    value.retrievalDataExposed !== false ||
    value.routingDataExposed !== false ||
    value.learningDataExposed !== false ||
    value.sideEffects?.storedPolicyRead !== true ||
    value.sideEffects?.storedNativeIntentRead !== true ||
    value.sideEffects?.storedOutcomeEvidenceRead !== true ||
    value.sideEffects?.providerAccessed !== false ||
    value.sideEffects?.policyStorageMutated !== false ||
    value.sideEffects?.routingAffected !== false ||
    value.sideEffects?.learningAffected !== false ||
    value.sideEffects?.databaseWritten !== false ||
    suggestion?.sourceId !== SUGGESTION_SOURCE ||
    !Number.isInteger(confirmationCount) ||
    confirmationCount < 3
  ) {
    return false
  }

  return cloneNativeIntentPurposeChangeRules(suggestion.changeCommand) !== null
}

export function usePolicyNativeIntentConfirmedOutcomePurposeSuggestion({
  loadSuggestionRequest = getPolicyNativeIntentConfirmedOutcomePurposeSuggestion,
} = {}) {
  const suggestion = ref(null)
  let activeRequestId = 0

  const clear = () => {
    activeRequestId += 1
    suggestion.value = null
  }

  const load = async policyIdValue => {
    const policyId = normalizePositiveInteger(policyIdValue)
    if (!policyId) {
      clear()
      return false
    }

    const requestId = activeRequestId + 1
    activeRequestId = requestId
    suggestion.value = null

    try {
      const result = await loadSuggestionRequest(policyId)
      if (requestId !== activeRequestId) return false
      if (!isConfirmedOutcomePurposeSuggestion(result, policyId)) return false

      suggestion.value = result
      return true
    } catch {
      return false
    }
  }

  return {
    suggestion,
    clear,
    load,
  }
}
