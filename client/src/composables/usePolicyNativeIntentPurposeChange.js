/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { computed, ref, unref, watch } from 'vue'
import {
  applyPolicyNativeIntentPurposeChange,
  getPolicyNativeIntentPurposeChange,
  preflightPolicyNativeIntentPurposeChange,
} from '@/api/policiesApi'
import {
  buildNativeIntentPurposeChangeCommand,
  cloneNativeIntentPurposeChangeRules,
} from '@/utils/policyNativeIntentPurposeChange'
import {
  createNativeIntentChangeIdempotencyKey,
} from '@/utils/policyNativeIntentChangeIdempotency'

const PURPOSE_CHANGE_READ_VERSION = 'policy.native_intent_purpose_change_read.v1'
const PURPOSE_CHANGE_READ_STATUS = 'native_intent_purpose_change_available'
const PURPOSE_CHANGE_STALE_CODES = new Set([
  'POLICY_NATIVE_INTENT_CHANGE_STALE_REVISION',
  'POLICY_NATIVE_INTENT_CHANGE_PURPOSE_PREFLIGHT_STALE_REVISION',
])
const PURPOSE_CHANGE_IDEMPOTENCY_IN_PROGRESS_CODE =
  'POLICY_NATIVE_INTENT_CHANGE_IDEMPOTENCY_KEY_IN_PROGRESS'
const PURPOSE_CHANGE_IDEMPOTENCY_REUSED_CODE =
  'POLICY_NATIVE_INTENT_CHANGE_IDEMPOTENCY_KEY_REUSED'

function normalizePositiveInteger(value) {
  const numericValue = Number(value)
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null
}

function responseData(response) {
  return response?.data && typeof response.data === 'object' ? response.data : null
}

function isPurposeChangeRead(value, policyId) {
  if (
    !value ||
    typeof value !== 'object' ||
    value.version !== PURPOSE_CHANGE_READ_VERSION ||
    value.statusId !== PURPOSE_CHANGE_READ_STATUS ||
    normalizePositiveInteger(value.policyId) !== policyId ||
    !normalizePositiveInteger(value.revision) ||
    value.authority?.source !== 'server_owned_native_intent' ||
    value.authority?.purposeChangeAllowed !== true ||
    value.authority?.browserAuthorityAccepted !== false ||
    value.compatibilityDataExposed !== false ||
    value.aiDataExposed !== false ||
    value.routingDataExposed !== false ||
    value.learningDataExposed !== false
  ) {
    return false
  }

  return cloneNativeIntentPurposeChangeRules(value.changeCommand) !== null
}

function getErrorStatus(error) {
  return Number(error?.response?.status) || null
}

function getErrorCode(error) {
  return typeof error?.response?.data?.code === 'string'
    ? error.response.data.code
    : ''
}

function isStaleRevisionError(error) {
  return PURPOSE_CHANGE_STALE_CODES.has(getErrorCode(error))
}

function isAppliedPurposeChange(value) {
  return value?.statusId === 'applied' &&
    value?.change?.applied === true &&
    normalizePositiveInteger(value?.change?.newIntentVersion)
}

export function usePolicyNativeIntentPurposeChange({
  loadPurposeChangeRequest = getPolicyNativeIntentPurposeChange,
  preflightPurposeChangeRequest = preflightPolicyNativeIntentPurposeChange,
  applyPurposeChangeRequest = applyPolicyNativeIntentPurposeChange,
  createIdempotencyKey = createNativeIntentChangeIdempotencyKey,
} = {}) {
  const read = ref(null)
  const draftRules = ref([])
  const loading = ref(false)
  const accessDenied = ref(false)
  const readError = ref('')
  const editing = ref(false)
  const preflight = ref(null)
  const preflightLoading = ref(false)
  const preflightError = ref('')
  const applying = ref(false)
  const applyError = ref('')
  const feedback = ref('')
  const applyAttempt = ref(null)
  let activeRequestId = 0

  const currentCommand = computed(() => buildNativeIntentPurposeChangeCommand(draftRules.value))
  const currentRevision = computed(() => normalizePositiveInteger(read.value?.revision))
  const available = computed(() => isPurposeChangeRead(read.value, normalizePositiveInteger(read.value?.policyId)))

  const clearPreflight = () => {
    preflight.value = null
    preflightError.value = ''
  }

  const clearApplyAttempt = () => {
    applyAttempt.value = null
  }

  const buildApplyAttemptFingerprint = (policyId, revision, command) => JSON.stringify({
    policyId,
    revision,
    command,
  })

  const resetDraft = () => {
    clearApplyAttempt()
    draftRules.value = cloneNativeIntentPurposeChangeRules(read.value?.changeCommand) || []
    clearPreflight()
    applyError.value = ''
    feedback.value = ''
  }

  const clear = () => {
    activeRequestId += 1
    read.value = null
    draftRules.value = []
    loading.value = false
    accessDenied.value = false
    readError.value = ''
    editing.value = false
    clearPreflight()
    applying.value = false
    applyError.value = ''
    feedback.value = ''
    clearApplyAttempt()
  }

  const load = async (policyIdValue) => {
    const policyId = normalizePositiveInteger(policyIdValue)
    if (!policyId) {
      clear()
      return false
    }

    const requestId = activeRequestId + 1
    activeRequestId = requestId
    loading.value = true
    accessDenied.value = false
    readError.value = ''

    try {
      const result = await loadPurposeChangeRequest(policyId)
      if (requestId !== activeRequestId) return false

      if (!isPurposeChangeRead(result, policyId)) {
        read.value = null
        draftRules.value = []
        readError.value = 'Classifarr could not load the current native purpose change.'
        return false
      }

      read.value = result
      draftRules.value = cloneNativeIntentPurposeChangeRules(result.changeCommand) || []
      clearPreflight()
      return true
    } catch (error) {
      if (requestId !== activeRequestId) return false

      if (getErrorStatus(error) === 403) {
        accessDenied.value = true
        read.value = null
        draftRules.value = []
        return false
      }

      read.value = null
      draftRules.value = []
      readError.value = 'Classifarr could not load the current native purpose change.'
      return false
    } finally {
      if (requestId === activeRequestId) loading.value = false
    }
  }

  const startEditing = () => {
    if (!available.value || applying.value) return false
    resetDraft()
    editing.value = true
    return true
  }

  const cancelEditing = () => {
    if (applying.value) return false
    resetDraft()
    editing.value = false
    return true
  }

  const runPreflight = async (policyIdValue) => {
    const policyId = normalizePositiveInteger(policyIdValue)
    const command = currentCommand.value
    const revision = currentRevision.value
    if (!policyId || !command || !revision || preflightLoading.value || applying.value) {
      preflight.value = null
      preflightError.value = 'Add at least one complete purpose rule before reviewing coverage.'
      return false
    }

    preflightLoading.value = true
    preflight.value = null
    preflightError.value = ''
    applyError.value = ''
    feedback.value = ''
    try {
      const response = await preflightPurposeChangeRequest(policyId, revision, command)
      const result = responseData(response)
      if (
        result?.advisory !== true ||
        result?.commandId !== 'update_purpose' ||
        Number(result?.expectedRevision) !== revision ||
        Number(result?.currentRevision) !== revision
      ) {
        preflightError.value = 'Classifarr could not verify purpose coverage for the current revision.'
        return false
      }

      preflight.value = result
      return true
    } catch (error) {
      if (isStaleRevisionError(error)) {
        await load(policyId)
        editing.value = true
        preflightError.value = 'The policy revision changed. Current purpose was reloaded; review it before continuing.'
        return false
      }

      preflightError.value = 'Classifarr could not review purpose coverage. Try again without changing the policy.'
      return false
    } finally {
      preflightLoading.value = false
    }
  }

  const apply = async (policyIdValue) => {
    const policyId = normalizePositiveInteger(policyIdValue)
    const command = currentCommand.value
    const revision = currentRevision.value
    if (!policyId || !command || !revision || applying.value || preflightLoading.value) {
      applyError.value = 'Add at least one complete purpose rule before applying this change.'
      return false
    }

    applying.value = true
    applyError.value = ''
    feedback.value = ''
    try {
      const attemptFingerprint = buildApplyAttemptFingerprint(policyId, revision, command)
      const idempotencyKey = applyAttempt.value?.fingerprint === attemptFingerprint
        ? applyAttempt.value.idempotencyKey
        : createIdempotencyKey()
      applyAttempt.value = { fingerprint: attemptFingerprint, idempotencyKey }
      const response = await applyPurposeChangeRequest(policyId, revision, command, { idempotencyKey })
      const result = responseData(response)
      if (!isAppliedPurposeChange(result)) {
        applyError.value = 'Classifarr could not confirm the native purpose change. Reload the current policy before retrying.'
        return false
      }

      clearApplyAttempt()

      const refreshed = await load(policyId)
      if (!refreshed) {
        applyError.value = 'The purpose change was applied, but Classifarr could not reload the current authority.'
        return false
      }

      editing.value = false
      feedback.value = result.change.replayed === true
        ? 'The earlier declared-purpose change was confirmed. Classifarr loaded the committed native revision.'
        : 'Declared purpose updated. Classifarr loaded the new native revision.'
      return true
    } catch (error) {
      if (isStaleRevisionError(error)) {
        clearApplyAttempt()
        await load(policyId)
        editing.value = true
        applyError.value = 'The policy revision changed. Current purpose was reloaded; review it before applying a new change.'
        return false
      }

      if (getErrorCode(error) === PURPOSE_CHANGE_IDEMPOTENCY_REUSED_CODE) {
        clearApplyAttempt()
        applyError.value = 'This purpose change request no longer matches its original retry key. Reload the current policy before starting a new change.'
        return false
      }

      if (getErrorCode(error) === PURPOSE_CHANGE_IDEMPOTENCY_IN_PROGRESS_CODE) {
        applyError.value = 'The same purpose change is still being committed. Retry without changing the draft to resume safely.'
        return false
      }

      applyError.value = 'Classifarr could not confirm the purpose change outcome. Retry without changing the draft to resume safely.'
      return false
    } finally {
      applying.value = false
    }
  }

  watch(draftRules, () => {
    const command = currentCommand.value
    const attemptFingerprint = command
      ? buildApplyAttemptFingerprint(
        normalizePositiveInteger(read.value?.policyId),
        currentRevision.value,
        command,
      )
      : null
    if (applyAttempt.value?.fingerprint !== attemptFingerprint) {
      clearApplyAttempt()
    }
    clearPreflight()
    applyError.value = ''
    feedback.value = ''
  }, { deep: true })

  const watchPurposeChange = policyIdSource => watch(
    () => unref(policyIdSource),
    load,
    { immediate: true },
  )

  return {
    read,
    draftRules,
    loading,
    accessDenied,
    readError,
    editing,
    preflight,
    preflightLoading,
    preflightError,
    applying,
    applyError,
    feedback,
    currentCommand,
    currentRevision,
    available,
    clearPreflight,
    resetDraft,
    clear,
    load,
    startEditing,
    cancelEditing,
    runPreflight,
    apply,
    watchPurposeChange,
  }
}

export {
  isAppliedPurposeChange,
  isPurposeChangeRead,
}
