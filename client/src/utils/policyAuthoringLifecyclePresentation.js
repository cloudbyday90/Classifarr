/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

export const POLICY_AUTHORING_LIFECYCLE_PRESENTATION_VERSION =
  'policy.authoring_lifecycle_presentation.v1'

export const POLICY_AUTHORING_LIFECYCLE_STATUS_IDS = Object.freeze({
  LOADING: 'loading',
  ELIGIBLE_TO_PREPARE_PROPOSAL: 'eligible_to_prepare_proposal',
  EXISTING_NATIVE_POLICY: 'existing_native_policy',
  EXISTING_COMPATIBILITY_POLICY: 'existing_compatibility_policy',
  PROFILE_RECOVERY_REQUIRED: 'profile_recovery_required',
  PROPOSAL_UNAVAILABLE: 'proposal_unavailable',
  UNAVAILABLE: 'unavailable',
})

const POLICY_AUTHORING_PROPOSAL_VERSION = 'policy.authoring_proposal.v1'
const MAX_LIBRARY_NAME_LENGTH = 160
const MAX_MEDIA_TYPE_LENGTH = 80
const MAX_POLICY_NAME_LENGTH = 180

const SERVER_LIFECYCLE_STATUS_IDS = new Set([
  POLICY_AUTHORING_LIFECYCLE_STATUS_IDS.ELIGIBLE_TO_PREPARE_PROPOSAL,
  POLICY_AUTHORING_LIFECYCLE_STATUS_IDS.EXISTING_NATIVE_POLICY,
  POLICY_AUTHORING_LIFECYCLE_STATUS_IDS.EXISTING_COMPATIBILITY_POLICY,
  POLICY_AUTHORING_LIFECYCLE_STATUS_IDS.PROFILE_RECOVERY_REQUIRED,
  POLICY_AUTHORING_LIFECYCLE_STATUS_IDS.PROPOSAL_UNAVAILABLE,
])

const STATUS_COPY = Object.freeze({
  [POLICY_AUTHORING_LIFECYCLE_STATUS_IDS.ELIGIBLE_TO_PREPARE_PROPOSAL]: {
    label: 'Ready to review',
    message: 'Classifarr found a current destination candidate for this library. Review it before creating a policy.',
    tone: 'success',
    canSelect: true,
  },
  [POLICY_AUTHORING_LIFECYCLE_STATUS_IDS.EXISTING_NATIVE_POLICY]: {
    label: 'Policy already exists',
    message: 'This library already has a native policy. New policy creation is unavailable for this library.',
    tone: 'neutral',
    canSelect: false,
  },
  [POLICY_AUTHORING_LIFECYCLE_STATUS_IDS.EXISTING_COMPATIBILITY_POLICY]: {
    label: 'Existing policy needs maintenance',
    message: 'This library already has a compatibility policy. Review its maintenance details before deciding whether a destination rule needs to change.',
    tone: 'warning',
    canSelect: false,
  },
  [POLICY_AUTHORING_LIFECYCLE_STATUS_IDS.PROFILE_RECOVERY_REQUIRED]: {
    label: 'Profile recovery in progress',
    message: 'Classifarr is automatically recovering the library profile before it can safely propose a policy. No action is needed.',
    tone: 'warning',
    canSelect: false,
  },
  [POLICY_AUTHORING_LIFECYCLE_STATUS_IDS.PROPOSAL_UNAVAILABLE]: {
    label: 'No safe proposal yet',
    message: 'Classifarr does not have a safe destination proposal for this library yet.',
    tone: 'neutral',
    canSelect: false,
  },
  [POLICY_AUTHORING_LIFECYCLE_STATUS_IDS.UNAVAILABLE]: {
    label: 'Authoring state unavailable',
    message: 'Classifarr could not load a safe authoring state for this library. Reload authoring states to check again.',
    tone: 'danger',
    canSelect: false,
  },
  [POLICY_AUTHORING_LIFECYCLE_STATUS_IDS.LOADING]: {
    label: 'Checking authoring state',
    message: 'Classifarr is checking the current policy authoring state for this library.',
    tone: 'neutral',
    canSelect: false,
  },
})

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

function normalizeString(value, maximumLength) {
  if (typeof value !== 'string' && typeof value !== 'number') return null

  const normalized = String(value)
    .normalize('NFKC')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maximumLength)

  return normalized || null
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value

  Object.values(value).forEach(deepFreeze)
  return Object.freeze(value)
}

function normalizeCatalogLibrary(value) {
  const source = asObject(value)
  const id = normalizePositiveInteger(source?.id)
  const name = normalizeString(source?.name, MAX_LIBRARY_NAME_LENGTH)
  const mediaType = normalizeString(source?.media_type ?? source?.mediaType, MAX_MEDIA_TYPE_LENGTH)

  if (!id || !name) return null

  return { id, name, mediaType }
}

function normalizeServerLibrary(value, expectedLibraryId) {
  if (!hasOnlyKeys(value, ['id', 'name', 'mediaType'])) return null

  const id = normalizePositiveInteger(value.id)
  const name = normalizeString(value.name, MAX_LIBRARY_NAME_LENGTH)
  const mediaType = value.mediaType === null
    ? null
    : normalizeString(value.mediaType, MAX_MEDIA_TYPE_LENGTH)

  if (!id || id !== expectedLibraryId || !name || (value.mediaType !== null && !mediaType)) {
    return null
  }

  return { id, name, mediaType }
}

function normalizePolicy(value, statusId) {
  const requiresPolicy = [
    POLICY_AUTHORING_LIFECYCLE_STATUS_IDS.EXISTING_NATIVE_POLICY,
    POLICY_AUTHORING_LIFECYCLE_STATUS_IDS.EXISTING_COMPATIBILITY_POLICY,
  ].includes(statusId)

  if (!requiresPolicy) return value === null ? null : undefined
  if (!hasOnlyKeys(value, ['id', 'name'])) return undefined

  const id = normalizePositiveInteger(value.id)
  const name = value.name === null ? null : normalizeString(value.name, MAX_POLICY_NAME_LENGTH)
  if (!id || (value.name !== null && !name)) return undefined

  return { id, name }
}

function isExpectedAction(action, statusId) {
  if (!hasOnlyKeys(action, ['id', 'available'])) return false

  if (statusId === POLICY_AUTHORING_LIFECYCLE_STATUS_IDS.ELIGIBLE_TO_PREPARE_PROPOSAL) {
    return action.id === 'prepare_proposal' && action.available === true
  }

  if (statusId === POLICY_AUTHORING_LIFECYCLE_STATUS_IDS.PROFILE_RECOVERY_REQUIRED) {
    return action.id === 'refresh_profile' && action.available === false
  }

  if (statusId === POLICY_AUTHORING_LIFECYCLE_STATUS_IDS.EXISTING_COMPATIBILITY_POLICY) {
    return action.id === 'review_reconciliation' && action.available === true
  }

  return action.id === 'inspect_policy' && action.available === false
}

function isExpectedProposal(proposal, statusId) {
  if (!hasOnlyKeys(proposal, ['available', 'reasonId'])) return false

  if (statusId === POLICY_AUTHORING_LIFECYCLE_STATUS_IDS.ELIGIBLE_TO_PREPARE_PROPOSAL) {
    return proposal.available === true && proposal.reasonId === 'current_profile_candidate_available'
  }

  if (statusId === POLICY_AUTHORING_LIFECYCLE_STATUS_IDS.PROFILE_RECOVERY_REQUIRED) {
    return proposal.available === false && proposal.reasonId === 'profile_not_current'
  }

  if (statusId === POLICY_AUTHORING_LIFECYCLE_STATUS_IDS.PROPOSAL_UNAVAILABLE) {
    return proposal.available === false && proposal.reasonId === 'profile_does_not_support_a_safe_proposal'
  }

  return proposal.available === false && proposal.reasonId === statusId
}

function buildPresentation({ statusId, library, policy = null, action = null }) {
  const copy = STATUS_COPY[statusId] || STATUS_COPY[POLICY_AUTHORING_LIFECYCLE_STATUS_IDS.UNAVAILABLE]

  return deepFreeze({
    version: POLICY_AUTHORING_LIFECYCLE_PRESENTATION_VERSION,
    statusId,
    library,
    policy,
    label: copy.label,
    message: copy.message,
    tone: copy.tone,
    canSelect: copy.canSelect,
    canReviewMaintenance: statusId === POLICY_AUTHORING_LIFECYCLE_STATUS_IDS.EXISTING_COMPATIBILITY_POLICY &&
      action?.id === 'review_reconciliation' && action.available === true,
  })
}

function buildFallbackLibrary(value) {
  return normalizeCatalogLibrary(value) || {
    id: null,
    name: 'Connected library',
    mediaType: null,
  }
}

export function buildPolicyAuthoringLifecycleLoadingPresentation(library) {
  return buildPresentation({
    statusId: POLICY_AUTHORING_LIFECYCLE_STATUS_IDS.LOADING,
    library: buildFallbackLibrary(library),
  })
}

export function buildPolicyAuthoringLifecycleUnavailablePresentation(library) {
  return buildPresentation({
    statusId: POLICY_AUTHORING_LIFECYCLE_STATUS_IDS.UNAVAILABLE,
    library: buildFallbackLibrary(library),
  })
}

export function adaptPolicyAuthoringLifecyclePresentation({ lifecycle, expectedLibrary } = {}) {
  const expected = normalizeCatalogLibrary(expectedLibrary)
  const source = asObject(lifecycle)
  const statusId = typeof source?.statusId === 'string' ? source.statusId : ''

  if (
    !expected ||
    source?.version !== POLICY_AUTHORING_PROPOSAL_VERSION ||
    !SERVER_LIFECYCLE_STATUS_IDS.has(statusId) ||
    !hasOnlyKeys(source, ['version', 'statusId', 'library', 'action', 'policy', 'proposal'])
  ) {
    return {
      ok: false,
      presentation: buildPolicyAuthoringLifecycleUnavailablePresentation(expectedLibrary),
    }
  }

  const library = normalizeServerLibrary(source.library, expected.id)
  const policy = normalizePolicy(source.policy, statusId)
  if (!library || policy === undefined || !isExpectedAction(source.action, statusId) ||
    !isExpectedProposal(source.proposal, statusId)) {
    return {
      ok: false,
      presentation: buildPolicyAuthoringLifecycleUnavailablePresentation(expectedLibrary),
    }
  }

  return {
    ok: true,
    presentation: buildPresentation({ statusId, library, policy, action: source.action }),
  }
}
