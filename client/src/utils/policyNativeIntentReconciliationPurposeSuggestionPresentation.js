/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

export const POLICY_NATIVE_INTENT_RECONCILIATION_PURPOSE_SUGGESTION_VERSION =
  'native_intent_reconciliation_purpose_suggestion.v1'

const AVAILABLE_STATUS_ID = 'available'
const MAX_LABEL_LENGTH = 160
const MAX_RULE_VALUE_LENGTH = 120
const MAX_RULE_VALUES = 5

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

function normalizeString(value, maximumLength = MAX_LABEL_LENGTH) {
  if (typeof value !== 'string' && typeof value !== 'number') return null

  const normalized = String(value)
    .normalize('NFKC')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
    .slice(0, maximumLength)

  return normalized || null
}

function normalizeIsoTimestamp(value) {
  if (value === null) return null
  const timestamp = new Date(value)
  return Number.isNaN(timestamp.getTime()) ? null : timestamp.toISOString()
}

function normalizePolicy(value, expectedPolicyId) {
  if (!hasOnlyKeys(value, ['id', 'name'])) return null

  const id = normalizePositiveInteger(value.id)
  const name = normalizeString(value.name, 180)
  if (!id || id !== expectedPolicyId || !name) return null

  return { id, name }
}

function normalizeLibrary(value) {
  if (!hasOnlyKeys(value, ['id', 'name', 'mediaType'])) return null

  const id = normalizePositiveInteger(value.id)
  const name = normalizeString(value.name)
  const mediaType = value.mediaType === null ? null : normalizeString(value.mediaType, 80)
  if (!id || !name || (value.mediaType !== null && !mediaType)) return null

  return { id, name, mediaType }
}

function normalizeProfile(value) {
  if (!hasOnlyKeys(value, ['itemCount', 'generatedAt', 'genreSignalCount'])) return null

  const itemCount = value.itemCount === null ? null : normalizePositiveInteger(value.itemCount)
  const generatedAt = normalizeIsoTimestamp(value.generatedAt)
  const genreSignalCount = Number(value.genreSignalCount)
  if ((value.itemCount !== null && !itemCount) ||
    (value.generatedAt !== null && !generatedAt) ||
    !Number.isInteger(genreSignalCount) || genreSignalCount < 0) {
    return null
  }

  return { itemCount, generatedAt, genreSignalCount }
}

function normalizeRule(value) {
  if (!hasOnlyKeys(value, ['signalType', 'operator', 'values', 'semantics', 'constraintMode'])) {
    return null
  }
  if (value.signalType !== 'genres' || value.operator !== 'require_any' ||
    value.semantics !== 'identity' || value.constraintMode !== 'advisory' ||
    !Array.isArray(value.values)) {
    return null
  }

  const values = Array.from(new Set(value.values
    .map(item => normalizeString(item, MAX_RULE_VALUE_LENGTH))
    .filter(Boolean)))
    .slice(0, MAX_RULE_VALUES)
  if (values.length === 0) return null

  return {
    signalType: 'genres',
    operator: 'require_any',
    values,
    semantics: 'identity',
    constraintMode: 'advisory',
  }
}

function buildUnavailablePresentation(statusId = 'unavailable') {
  return {
    statusId,
    available: false,
    policy: null,
    library: null,
    profile: null,
    suggestion: null,
  }
}

export function adaptPolicyNativeIntentReconciliationPurposeSuggestion({ suggestion, expectedPolicyId } = {}) {
  const expectedId = normalizePositiveInteger(expectedPolicyId)
  const source = asObject(suggestion)
  if (!expectedId || !source ||
    source.version !== POLICY_NATIVE_INTENT_RECONCILIATION_PURPOSE_SUGGESTION_VERSION ||
    typeof source.statusId !== 'string' || typeof source.available !== 'boolean' ||
    source.rawProfileExposed !== false || source.persisted !== false ||
    source.routingAffected !== false || source.learningAffected !== false || source.aiInvoked !== false) {
    return { ok: false, presentation: buildUnavailablePresentation() }
  }

  if (source.statusId !== AVAILABLE_STATUS_ID) {
    if (source.available !== false || source.suggestion !== null) {
      return { ok: false, presentation: buildUnavailablePresentation() }
    }
    return {
      ok: true,
      presentation: buildUnavailablePresentation(normalizeString(source.statusId, 80) || 'unavailable'),
    }
  }

  if (source.available !== true || !hasOnlyKeys(source.suggestion, ['sourceId', 'rules'])) {
    return { ok: false, presentation: buildUnavailablePresentation() }
  }

  const policy = normalizePolicy(source.policy, expectedId)
  const library = normalizeLibrary(source.library)
  const profile = normalizeProfile(source.profile)
  const rules = Array.isArray(source.suggestion.rules)
    ? source.suggestion.rules.map(normalizeRule).filter(Boolean)
    : []
  if (!policy || !library || !profile || source.suggestion.sourceId !== 'current_library_profile' || rules.length !== 1) {
    return { ok: false, presentation: buildUnavailablePresentation() }
  }

  return {
    ok: true,
    presentation: {
      statusId: AVAILABLE_STATUS_ID,
      available: true,
      policy,
      library,
      profile,
      suggestion: {
        sourceId: 'current_library_profile',
        rules,
      },
    },
  }
}
