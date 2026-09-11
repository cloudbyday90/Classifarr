/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { ref } from 'vue'
import api from '@/api'
import {
  createNativeIntentChangeIdempotencyKey,
} from '@/utils/policyNativeIntentChangeIdempotency'
import {
  normalizePolicyPurposeProposalBatch,
} from '@/utils/policyPurposeProposalBatch'

function getErrorMessage(error, fallback) {
  const responseMessage = error?.response?.data?.message
  const responseError = error?.response?.data?.error
  if (typeof responseMessage === 'string' && responseMessage.trim()) return responseMessage
  if (typeof responseError === 'string' && responseError.trim()) return responseError
  return fallback
}

function getReadyAction(proposal) {
  const fingerprint = typeof proposal?.proposalFingerprint === 'string'
    ? proposal.proposalFingerprint
    : ''
  const candidatePolicyIds = Array.isArray(proposal?.action?.candidatePolicyIds)
    ? proposal.action.candidatePolicyIds.filter(id => Number.isInteger(Number(id)) && Number(id) > 0)
    : []
  return proposal?.statusId === 'ready_for_apply' &&
    proposal?.action?.available === true && fingerprint && candidatePolicyIds.length > 0
    ? { fingerprint, candidatePolicyIds: candidatePolicyIds.map(Number) }
    : null
}

/**
 * Owns the short-lived browser retry key for a single all-or-nothing purpose
 * proposal. It is reset only after a successful apply or a newly loaded plan.
 */
export function usePolicyPurposeProposalBatch() {
  const proposal = ref(null)
  const isLoading = ref(false)
  const isApplying = ref(false)
  const errorMessage = ref('')
  const actionErrorMessage = ref('')
  let idempotencyKey = null

  async function loadProposal() {
    isLoading.value = true
    errorMessage.value = ''
    try {
      proposal.value = normalizePolicyPurposeProposalBatch(
        await api.getPolicyPurposeProposalBatch()
      )
      if (!proposal.value) throw new Error('Purpose proposal response was invalid.')
      idempotencyKey = null
      return proposal.value
    } catch (error) {
      errorMessage.value = getErrorMessage(error, 'Unable to load current purpose setup.')
      return null
    } finally {
      isLoading.value = false
    }
  }

  async function applyProposal() {
    const action = getReadyAction(proposal.value)
    if (!action || isApplying.value) return null

    isApplying.value = true
    actionErrorMessage.value = ''
    idempotencyKey ||= createNativeIntentChangeIdempotencyKey()
    try {
      const response = await api.applyPolicyPurposeProposalBatch(
        action.fingerprint,
        action.candidatePolicyIds,
        { idempotencyKey }
      )
      idempotencyKey = null
      return response?.data ?? response
    } catch (error) {
      actionErrorMessage.value = getErrorMessage(
        error,
        'Classifarr could not apply the purpose setup. No partial policy changes were made.'
      )
      return null
    } finally {
      isApplying.value = false
    }
  }

  return {
    proposal,
    isLoading,
    isApplying,
    errorMessage,
    actionErrorMessage,
    loadProposal,
    applyProposal,
  }
}
