/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

export const POLICY_AUTHORING_PROPOSAL_ADMISSION_STATUS_IDS = Object.freeze({
  CREATED: 'proposal_admission_created',
  REPLAYED: 'proposal_admission_replayed',
  PROPOSAL_UNAVAILABLE: 'proposal_unavailable',
  PROPOSAL_EXPIRED: 'proposal_expired',
  PROPOSAL_STALE: 'proposal_stale',
  EXISTING_POLICY: 'existing_policy',
  REQUEST_IN_PROGRESS: 'request_in_progress',
  IDEMPOTENCY_KEY_REUSED: 'idempotency_key_reused',
})

const SERVER_PROPOSAL_VERSION = 'policy.authoring_proposal.v1'
const SUCCESS_STATUS_IDS = new Set([
  POLICY_AUTHORING_PROPOSAL_ADMISSION_STATUS_IDS.CREATED,
  POLICY_AUTHORING_PROPOSAL_ADMISSION_STATUS_IDS.REPLAYED,
])
const FAILURE_STATUS_IDS = new Set([
  POLICY_AUTHORING_PROPOSAL_ADMISSION_STATUS_IDS.PROPOSAL_UNAVAILABLE,
  POLICY_AUTHORING_PROPOSAL_ADMISSION_STATUS_IDS.PROPOSAL_EXPIRED,
  POLICY_AUTHORING_PROPOSAL_ADMISSION_STATUS_IDS.PROPOSAL_STALE,
  POLICY_AUTHORING_PROPOSAL_ADMISSION_STATUS_IDS.EXISTING_POLICY,
  POLICY_AUTHORING_PROPOSAL_ADMISSION_STATUS_IDS.REQUEST_IN_PROGRESS,
  POLICY_AUTHORING_PROPOSAL_ADMISSION_STATUS_IDS.IDEMPOTENCY_KEY_REUSED,
])

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null
}

function hasOnlyKeys(value, expectedKeys) {
  const source = asObject(value)
  if (!source) return false

  const keys = Object.keys(source).sort()
  const allowedKeys = [...expectedKeys].sort()
  return keys.length === allowedKeys.length && keys.every((key, index) => key === allowedKeys[index])
}

function normalizePositiveInteger(value) {
  const numericValue = Number(value)
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null
}

function normalizeName(value) {
  if (typeof value !== 'string') return null

  const normalized = value
    .normalize('NFKC')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180)

  return normalized || null
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value

  Object.values(value).forEach(deepFreeze)
  return Object.freeze(value)
}

export function adaptPolicyAuthoringProposalAdmission({ response, expectedLibraryId } = {}) {
  const source = asObject(response)
  const libraryId = normalizePositiveInteger(expectedLibraryId)
  const statusId = source?.statusId

  if (
    libraryId === null ||
    source?.version !== SERVER_PROPOSAL_VERSION ||
    typeof statusId !== 'string' ||
    !hasOnlyKeys(source, ['version', 'statusId', 'policy', 'recovery']) ||
    !hasOnlyKeys(source.recovery, ['lifecycleReloadRequired']) ||
    typeof source.recovery.lifecycleReloadRequired !== 'boolean'
  ) {
    return { ok: false, result: null }
  }

  if (SUCCESS_STATUS_IDS.has(statusId)) {
    if (!hasOnlyKeys(source.policy, ['id', 'libraryId', 'name'])) {
      return { ok: false, result: null }
    }

    const policyId = normalizePositiveInteger(source.policy.id)
    const policyLibraryId = normalizePositiveInteger(source.policy.libraryId)
    const name = normalizeName(source.policy.name)
    if (!policyId || policyLibraryId !== libraryId || !name || source.recovery.lifecycleReloadRequired) {
      return { ok: false, result: null }
    }

    return {
      ok: true,
      result: deepFreeze({
        statusId,
        policy: { id: policyId, libraryId, name },
        lifecycleReloadRequired: false,
      }),
    }
  }

  if (!FAILURE_STATUS_IDS.has(statusId) || source.policy !== null || !source.recovery.lifecycleReloadRequired) {
    return { ok: false, result: null }
  }

  return {
    ok: true,
    result: deepFreeze({
      statusId,
      policy: null,
      lifecycleReloadRequired: true,
    }),
  }
}
