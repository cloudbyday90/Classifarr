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
import {
  getPolicyOperatorWorkflow,
  validatePolicyOperatorWorkflowCustomIntentSignal,
} from '@/api/policiesApi'
import {
  isApprovedConstraintValueEligibility,
} from '@/utils/policyIntentConstraintValueEligibility'
import {
  isApprovedPolicyOperatorWorkflowReadinessPresentation,
} from '@/utils/policyOperatorWorkflowReadinessPresentation'

const WORKFLOW_LOAD_ERROR = 'Classifarr could not load the library workflow. You can still review the connected library details.'
const CUSTOM_INTENT_SIGNAL_VALIDATION_ERROR = 'Classifarr could not validate that custom destination value.'

function normalizeLibraryId(value) {
  const libraryId = Number(value)
  return Number.isInteger(libraryId) && libraryId > 0 ? libraryId : null
}

function isDisplayOnlyWorkflowRead(value, expectedLibraryId) {
  const responseLibraryId = normalizeLibraryId(value?.library?.id)

  return Boolean(
    value &&
    typeof value === 'object' &&
    value.version === 'policy.operator_workflow_read.v4' &&
    responseLibraryId === expectedLibraryId &&
    Array.isArray(value.workflow?.sections) &&
    value.authority?.displayProjection === true &&
    value.authority?.automationDecision === false &&
    value.authority?.policyPersistence === false &&
    value.authority?.routingExecution === false &&
    isApprovedConstraintValueEligibility(value.constraintValueEligibility) &&
    isApprovedPolicyOperatorWorkflowReadinessPresentation({
      presentation: value.readinessPresentation,
      readiness: value.workflow?.readiness,
    })
  )
}

export function usePolicyOperatorWorkflow({
  loadWorkflowRequest = getPolicyOperatorWorkflow,
  validateCustomIntentSignalRequest = validatePolicyOperatorWorkflowCustomIntentSignal,
} = {}) {
  const workflowRead = ref(null)
  const loading = ref(false)
  const error = ref('')
  const customIntentSignalValidationLoading = ref(false)
  const customIntentSignalValidationError = ref('')
  const customIntentSignalValidationMessage = ref('')
  let activeRequestId = 0
  let activeCustomValidationRequestId = 0

  const clearWorkflow = () => {
    activeRequestId += 1
    activeCustomValidationRequestId += 1
    workflowRead.value = null
    loading.value = false
    error.value = ''
    customIntentSignalValidationLoading.value = false
    customIntentSignalValidationError.value = ''
    customIntentSignalValidationMessage.value = ''
  }

  const loadWorkflow = async (libraryIdValue) => {
    const libraryId = normalizeLibraryId(libraryIdValue)
    if (libraryId === null) {
      clearWorkflow()
      return false
    }

    const requestId = activeRequestId + 1
    activeRequestId = requestId
    activeCustomValidationRequestId += 1
    workflowRead.value = null
    error.value = ''
    customIntentSignalValidationLoading.value = false
    customIntentSignalValidationError.value = ''
    customIntentSignalValidationMessage.value = ''
    loading.value = true

    try {
      const result = await loadWorkflowRequest(libraryId)
      if (requestId !== activeRequestId) return false

      if (!isDisplayOnlyWorkflowRead(result, libraryId)) {
        error.value = WORKFLOW_LOAD_ERROR
        return false
      }

      workflowRead.value = result
      return true
    } catch {
      if (requestId === activeRequestId) {
        error.value = WORKFLOW_LOAD_ERROR
      }
      return false
    } finally {
      if (requestId === activeRequestId) {
        loading.value = false
      }
    }
  }

  const watchWorkflow = (libraryIdSource) => watch(
    () => unref(libraryIdSource),
    loadWorkflow,
    { immediate: true }
  )

  const validateCustomIntentSignal = async (libraryIdValue, payload) => {
    const libraryId = normalizeLibraryId(libraryIdValue)
    const currentWorkflowLibraryId = normalizeLibraryId(workflowRead.value?.library?.id)
    if (libraryId === null || currentWorkflowLibraryId !== libraryId) {
      customIntentSignalValidationError.value = CUSTOM_INTENT_SIGNAL_VALIDATION_ERROR
      return false
    }

    const workflowRequestId = activeRequestId
    const requestId = activeCustomValidationRequestId + 1
    activeCustomValidationRequestId = requestId
    customIntentSignalValidationLoading.value = true
    customIntentSignalValidationError.value = ''
    customIntentSignalValidationMessage.value = ''

    try {
      const response = await validateCustomIntentSignalRequest(libraryId, payload)
      const result = response?.data

      if (requestId !== activeCustomValidationRequestId || workflowRequestId !== activeRequestId) {
        return false
      }

      if (!isDisplayOnlyWorkflowRead(result, libraryId)) {
        customIntentSignalValidationError.value = CUSTOM_INTENT_SIGNAL_VALIDATION_ERROR
        return false
      }

      workflowRead.value = result
      customIntentSignalValidationMessage.value = 'Classifarr checked the custom value. Review it below before adding it to this policy.'
      return true
    } catch (requestError) {
      if (requestId === activeCustomValidationRequestId) {
        customIntentSignalValidationError.value = requestError?.response?.data?.error ||
          CUSTOM_INTENT_SIGNAL_VALIDATION_ERROR
      }
      return false
    } finally {
      if (requestId === activeCustomValidationRequestId) {
        customIntentSignalValidationLoading.value = false
      }
    }
  }

  return {
    workflowRead,
    loading,
    error,
    customIntentSignalValidationLoading,
    customIntentSignalValidationError,
    customIntentSignalValidationMessage,
    clearWorkflow,
    loadWorkflow,
    watchWorkflow,
    validateCustomIntentSignal,
  }
}
