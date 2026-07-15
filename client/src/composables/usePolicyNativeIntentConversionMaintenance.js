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

import { computed, ref } from 'vue'
import api from '@/api'

const MAX_SELECTED_POLICY_COUNT = 25
const POLICY_NATIVE_INTENT_CONVERSION_CONFIRMATION = 'CONVERT_NATIVE_INTENT'

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function toPositiveInteger(value) {
  const normalizedValue = Number(value)
  return Number.isInteger(normalizedValue) && normalizedValue > 0
    ? normalizedValue
    : null
}

function getErrorMessage(error, fallbackMessage) {
  const responseMessage = error?.response?.data?.message
  const errorMessage = error?.message

  return typeof responseMessage === 'string' && responseMessage.trim()
    ? responseMessage
    : typeof errorMessage === 'string' && errorMessage.trim()
      ? errorMessage
      : fallbackMessage
}

function normalizeCandidateReport(preview) {
  const candidateReport = preview?.candidateReport

  return candidateReport && typeof candidateReport === 'object'
    ? candidateReport
    : { candidates: [], summary: {}, bounded: {} }
}

export function usePolicyNativeIntentConversionMaintenance() {
  const preview = ref(null)
  const isLoading = ref(false)
  const isApplying = ref(false)
  const errorMessage = ref('')
  const successMessage = ref('')
  const runtimeObservation = ref(null)
  const selectedPolicyIds = ref([])

  const candidateReport = computed(() => normalizeCandidateReport(preview.value))
  const candidates = computed(() => asArray(candidateReport.value.candidates))
  const selectedPolicyIdSet = computed(() => new Set(selectedPolicyIds.value))
  const selectedCandidates = computed(() => candidates.value.filter(candidate => (
    selectedPolicyIdSet.value.has(toPositiveInteger(candidate?.policyId))
  )))
  const selectedCount = computed(() => selectedPolicyIds.value.length)
  const canOpenConfirmation = computed(() => (
    selectedCount.value > 0 && selectedCount.value <= MAX_SELECTED_POLICY_COUNT && !isApplying.value
  ))

  function isSelected(policyId) {
    const normalizedPolicyId = toPositiveInteger(policyId)
    return normalizedPolicyId ? selectedPolicyIdSet.value.has(normalizedPolicyId) : false
  }

  function selectPolicy(policyId, selected) {
    const normalizedPolicyId = toPositiveInteger(policyId)
    if (!normalizedPolicyId) {
      return
    }

    const candidate = candidates.value.find(item => (
      toPositiveInteger(item?.policyId) === normalizedPolicyId
    ))
    const currentlySelected = isSelected(normalizedPolicyId)
    if (selected && !currentlySelected) {
      if (candidate?.canConvert !== true) {
        return
      }
      if (selectedPolicyIds.value.length >= MAX_SELECTED_POLICY_COUNT) {
        return
      }
      selectedPolicyIds.value = [...selectedPolicyIds.value, normalizedPolicyId]
      return
    }

    if (!selected && currentlySelected) {
      selectedPolicyIds.value = selectedPolicyIds.value.filter(id => id !== normalizedPolicyId)
    }
  }

  function clearSelection() {
    selectedPolicyIds.value = []
  }

  function retainCurrentReadySelection() {
    const readyPolicyIds = new Set(candidates.value
      .filter(candidate => candidate?.canConvert === true)
      .map(candidate => toPositiveInteger(candidate?.policyId))
      .filter(Boolean))

    selectedPolicyIds.value = selectedPolicyIds.value.filter(policyId => readyPolicyIds.has(policyId))
  }

  async function loadPreview() {
    isLoading.value = true
    errorMessage.value = ''

    try {
      preview.value = await api.getNativeIntentConversionPreview()
      retainCurrentReadySelection()
    } catch (error) {
      errorMessage.value = getErrorMessage(
        error,
        'Unable to load the current native intent conversion candidates.'
      )
    } finally {
      isLoading.value = false
    }
  }

  async function applySelectedPolicies(confirmation) {
    if (!canOpenConfirmation.value) {
      return { applied: false, reason: 'selection_invalid' }
    }

    if (confirmation !== POLICY_NATIVE_INTENT_CONVERSION_CONFIRMATION) {
      return { applied: false, reason: 'confirmation_invalid' }
    }

    isApplying.value = true
    errorMessage.value = ''
    successMessage.value = ''
    runtimeObservation.value = null

    try {
      const response = await api.applyNativeIntentConversion({
        policy_ids: selectedPolicyIds.value,
        confirmation,
      })
      const result = response?.data ?? response
      const appliedPolicyCount = Number(result?.summary?.appliedPolicyCount ?? 0)
      const alreadyConvertedCount = Number(result?.summary?.alreadyConvertedCount ?? 0)
      runtimeObservation.value = result?.runtimeObservation ?? null

      successMessage.value = appliedPolicyCount > 0
        ? `${appliedPolicyCount} ${appliedPolicyCount === 1 ? 'policy was' : 'policies were'} converted to native intent.`
        : alreadyConvertedCount > 0
          ? 'The selected policies were already current.'
          : 'No policy conversion was needed.'
      clearSelection()
      await loadPreview()
      return { applied: true, result }
    } catch (error) {
      errorMessage.value = getErrorMessage(
        error,
        'Native intent conversion could not be completed. Refresh the preview and try again.'
      )
      return { applied: false, reason: 'request_failed' }
    } finally {
      isApplying.value = false
    }
  }

  return {
    MAX_SELECTED_POLICY_COUNT,
    POLICY_NATIVE_INTENT_CONVERSION_CONFIRMATION,
    preview,
    candidateReport,
    candidates,
    selectedCandidates,
    selectedCount,
    isLoading,
    isApplying,
    errorMessage,
    successMessage,
    runtimeObservation,
    canOpenConfirmation,
    isSelected,
    selectPolicy,
    clearSelection,
    loadPreview,
    applySelectedPolicies,
  }
}
