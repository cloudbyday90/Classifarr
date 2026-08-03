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
  getPolicyOperatorWorkflow,
  preparePolicyAuthoringProposal,
} from '@/api/policiesApi'
import {
  adaptPolicyAuthoringLifecyclePresentation,
} from '@/utils/policyAuthoringLifecyclePresentation'
import {
  adaptPolicyAuthoringPreparedProposalPresentation,
} from '@/utils/policyAuthoringProposalPresentation'
import {
  adaptPolicyAuthoringWorkflowPresentation,
} from '@/utils/policyAuthoringWorkflowPresentation'

const PROPOSAL_LOAD_ERROR = 'Classifarr could not prepare a destination proposal. Return to library policy setup and review the current state.'

function normalizePositiveInteger(value) {
  const numericValue = Number(value)
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null
}

function unwrapResponse(response) {
  return response?.data ?? response
}

export function usePolicyAuthoringDestinationProposal({
  loadWorkflowRequest = getPolicyOperatorWorkflow,
  prepareProposalRequest = preparePolicyAuthoringProposal,
} = {}) {
  const presentation = ref(null)
  const admission = ref(null)
  const lifecycle = ref(null)
  const loading = ref(false)
  const error = ref('')
  let activeRequestId = 0

  const clear = () => {
    activeRequestId += 1
    presentation.value = null
    admission.value = null
    lifecycle.value = null
    loading.value = false
    error.value = ''
  }

  const load = async expectedLibrary => {
    const libraryId = normalizePositiveInteger(expectedLibrary?.id)
    if (!libraryId) {
      clear()
      return false
    }

    const requestId = activeRequestId + 1
    activeRequestId = requestId
    presentation.value = null
    admission.value = null
    lifecycle.value = null
    error.value = ''
    loading.value = true

    const [workflowResult, proposalResult] = await Promise.allSettled([
      typeof loadWorkflowRequest === 'function'
        ? loadWorkflowRequest(libraryId)
        : Promise.reject(new TypeError('A workflow request is required.')),
      typeof prepareProposalRequest === 'function'
        ? prepareProposalRequest(libraryId)
        : Promise.reject(new TypeError('A proposal request is required.')),
    ])

    if (requestId !== activeRequestId) return false

    const workflowPresentation = workflowResult.status === 'fulfilled'
      ? adaptPolicyAuthoringWorkflowPresentation({
        workflowRead: unwrapResponse(workflowResult.value),
        expectedLibraryId: libraryId,
      }).presentation
      : null

    if (proposalResult.status !== 'fulfilled') {
      error.value = PROPOSAL_LOAD_ERROR
      loading.value = false
      return false
    }

    const proposalResponse = unwrapResponse(proposalResult.value)
    const preparedResult = adaptPolicyAuthoringPreparedProposalPresentation({
      response: proposalResponse,
      expectedLibrary,
      workflowPresentation,
    })
    if (preparedResult.ok) {
      presentation.value = preparedResult.presentation
      admission.value = preparedResult.admission
      loading.value = false
      return true
    }

    const lifecycleResult = adaptPolicyAuthoringLifecyclePresentation({
      lifecycle: proposalResponse,
      expectedLibrary,
    })
    if (lifecycleResult.ok) {
      lifecycle.value = lifecycleResult.presentation
      loading.value = false
      return false
    }

    error.value = PROPOSAL_LOAD_ERROR
    loading.value = false
    return false
  }

  return {
    presentation,
    admission,
    lifecycle,
    loading,
    error,
    clear,
    load,
  }
}
