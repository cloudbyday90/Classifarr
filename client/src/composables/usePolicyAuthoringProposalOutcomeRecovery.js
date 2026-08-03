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

export const POLICY_AUTHORING_PROPOSAL_RECOVERY_REASON_IDS = Object.freeze({
  ADMISSION_OUTCOME: 'admission_outcome',
  UNCERTAIN_ADMISSION: 'uncertain_admission',
})

export const POLICY_AUTHORING_PROPOSAL_RECOVERY_NOTICE_STATUS_IDS = Object.freeze({
  CHECKING: 'checking',
  RECONCILED: 'reconciled',
  UNAVAILABLE: 'unavailable',
})

const KNOWN_REASON_IDS = new Set(Object.values(POLICY_AUTHORING_PROPOSAL_RECOVERY_REASON_IDS))

function normalizePositiveInteger(value) {
  const numericValue = Number(value)
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null
}

function buildNotice(statusId, message) {
  return Object.freeze({ statusId, message })
}

function normalizeRecovery(value) {
  const libraryId = normalizePositiveInteger(value?.libraryId)
  if (libraryId === null || !KNOWN_REASON_IDS.has(value?.reasonId)) return null

  return { libraryId, reasonId: value.reasonId }
}

/**
 * Reconciles an uncertain proposal admission by reading the server lifecycle.
 * It never retains proposal data or invokes prepare/admit endpoints itself.
 */
export function usePolicyAuthoringProposalOutcomeRecovery({
  reloadLifecycle = null,
} = {}) {
  const loading = ref(false)
  const notice = ref(null)
  let activeRequestId = 0

  const clear = () => {
    activeRequestId += 1
    loading.value = false
    notice.value = null
  }

  const recover = async recovery => {
    const normalizedRecovery = normalizeRecovery(recovery)
    if (!normalizedRecovery || typeof reloadLifecycle !== 'function') {
      notice.value = buildNotice(
        POLICY_AUTHORING_PROPOSAL_RECOVERY_NOTICE_STATUS_IDS.UNAVAILABLE,
        'Classifarr could not confirm the latest policy state. Return to library policy setup and use its reload action.'
      )
      return null
    }

    const requestId = activeRequestId + 1
    activeRequestId = requestId
    loading.value = true
    notice.value = buildNotice(
      POLICY_AUTHORING_PROPOSAL_RECOVERY_NOTICE_STATUS_IDS.CHECKING,
      'Classifarr is checking the latest policy state before offering another action.'
    )

    try {
      const lifecycleStatusId = await reloadLifecycle(normalizedRecovery.libraryId)
      if (requestId !== activeRequestId) return null

      if (typeof lifecycleStatusId !== 'string' || !lifecycleStatusId) {
        notice.value = buildNotice(
          POLICY_AUTHORING_PROPOSAL_RECOVERY_NOTICE_STATUS_IDS.UNAVAILABLE,
          'Classifarr could not confirm the latest policy state. Return to library policy setup and use its reload action.'
        )
        return null
      }

      notice.value = buildNotice(
        POLICY_AUTHORING_PROPOSAL_RECOVERY_NOTICE_STATUS_IDS.RECONCILED,
        'Classifarr checked the current policy state. Review the latest destination guidance below.'
      )
      return Object.freeze({
        libraryId: normalizedRecovery.libraryId,
        lifecycleStatusId,
      })
    } catch {
      if (requestId === activeRequestId) {
        notice.value = buildNotice(
          POLICY_AUTHORING_PROPOSAL_RECOVERY_NOTICE_STATUS_IDS.UNAVAILABLE,
          'Classifarr could not confirm the latest policy state. Return to library policy setup and use its reload action.'
        )
      }
      return null
    } finally {
      if (requestId === activeRequestId) {
        loading.value = false
      }
    }
  }

  return {
    loading,
    notice,
    clear,
    recover,
  }
}
