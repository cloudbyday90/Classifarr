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
import { getPolicyOperatorWorkflow } from '@/api/policiesApi'

const WORKFLOW_LOAD_ERROR = 'Classifarr could not load the library workflow. You can still review the connected library details.'

function normalizeLibraryId(value) {
  const libraryId = Number(value)
  return Number.isInteger(libraryId) && libraryId > 0 ? libraryId : null
}

function isDisplayOnlyWorkflowRead(value, expectedLibraryId) {
  const responseLibraryId = normalizeLibraryId(value?.library?.id)

  return Boolean(
    value &&
    typeof value === 'object' &&
    value.version === 'policy.operator_workflow_read.v2' &&
    responseLibraryId === expectedLibraryId &&
    Array.isArray(value.workflow?.sections) &&
    value.authority?.displayProjection === true &&
    value.authority?.automationDecision === false &&
    value.authority?.policyPersistence === false &&
    value.authority?.routingExecution === false
  )
}

export function usePolicyOperatorWorkflow({
  loadWorkflowRequest = getPolicyOperatorWorkflow,
} = {}) {
  const workflowRead = ref(null)
  const loading = ref(false)
  const error = ref('')
  let activeRequestId = 0

  const clearWorkflow = () => {
    activeRequestId += 1
    workflowRead.value = null
    loading.value = false
    error.value = ''
  }

  const loadWorkflow = async (libraryIdValue) => {
    const libraryId = normalizeLibraryId(libraryIdValue)
    if (libraryId === null) {
      clearWorkflow()
      return false
    }

    const requestId = activeRequestId + 1
    activeRequestId = requestId
    workflowRead.value = null
    error.value = ''
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

  return {
    workflowRead,
    loading,
    error,
    clearWorkflow,
    loadWorkflow,
    watchWorkflow,
  }
}
