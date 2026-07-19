/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

export const POLICY_NATIVE_CREATE_HANDOFF_STATUS_IDS = Object.freeze({
  CREATED: 'created',
  CREATED_DETAILS_UNAVAILABLE: 'created_details_unavailable',
})

const ESTABLISHED_STATUS_IDS = new Set([
  'initial_intent_established',
  'initial_intent_establishment_replayed',
])

const INTENT_COLLECTIONS = Object.freeze([
  ['purpose', 'destination'],
  ['hard_limits', 'hard limit'],
  ['helpful_hints', 'helpful match'],
  ['avoid', 'avoid rule'],
])

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function toPositiveInteger(value) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function unwrapResponse(response) {
  return asObject(response?.data ?? response)
}

function pluralize(count, label) {
  return `${count} ${label}${count === 1 ? '' : 's'}`
}

function summarizePersistedIntent(policy = {}) {
  const contract = asObject(policy.policy_intent_contract)
  if (contract.source !== 'native_intent') return null

  const collections = Object.fromEntries(INTENT_COLLECTIONS.map(([key, label]) => {
    const ruleCount = asArray(contract[key]).length
    return [key, {
      ruleCount,
      label: pluralize(ruleCount, label),
    }]
  }))

  return {
    ruleCount: INTENT_COLLECTIONS.reduce(
      (total, [key]) => total + collections[key].ruleCount,
      0,
    ),
    purposeRuleCount: collections.purpose.ruleCount,
    collections,
  }
}

function buildRoutingSummary(nativeEstablishment = {}) {
  const configured = nativeEstablishment.routingConfigured === true

  return configured
    ? {
      configured: true,
      label: 'Routing target set',
      message: 'Approved matches can use the configured routing target when the policy is otherwise ready.',
    }
    : {
      configured: false,
      label: 'Routing setup still needed',
      message: 'Set a routing target before approved matches can be applied automatically.',
    }
}

export function buildPolicyNativeCreateHandoff({
  createResponse = null,
  persistedPolicy = null,
} = {}) {
  const createdPolicy = unwrapResponse(createResponse)
  const nativeEstablishment = asObject(createdPolicy.native_intent_establishment)
  const policyId = toPositiveInteger(createdPolicy.id)

  if (!policyId || !ESTABLISHED_STATUS_IDS.has(nativeEstablishment.statusId)) {
    return null
  }

  const persisted = asObject(persistedPolicy)
  const persistedPolicyId = toPositiveInteger(persisted.id)
  const hasMatchingPersistedPolicy = persistedPolicyId === policyId
  const intentSummary = hasMatchingPersistedPolicy
    ? summarizePersistedIntent(persisted)
    : null
  const ruleCount = intentSummary?.ruleCount ?? Math.max(0, Number(nativeEstablishment.ruleCount) || 0)
  const policyName = hasMatchingPersistedPolicy
    ? persisted.name
    : createdPolicy.name
  const libraryName = hasMatchingPersistedPolicy
    ? persisted.library_name
    : createdPolicy.library_name

  return {
    statusId: intentSummary
      ? POLICY_NATIVE_CREATE_HANDOFF_STATUS_IDS.CREATED
      : POLICY_NATIVE_CREATE_HANDOFF_STATUS_IDS.CREATED_DETAILS_UNAVAILABLE,
    policy: {
      id: policyId,
      name: typeof policyName === 'string' && policyName.trim()
        ? policyName.trim()
        : 'Policy',
      libraryName: typeof libraryName === 'string' && libraryName.trim()
        ? libraryName.trim()
        : 'the selected library',
    },
    declaredIntent: {
      authorityLabel: 'Declared destination intent',
      ruleCount,
      purposeRuleCount: intentSummary?.purposeRuleCount ?? ruleCount,
      collections: intentSummary?.collections ?? null,
    },
    routing: buildRoutingSummary(nativeEstablishment),
    detailsAvailable: Boolean(intentSummary),
  }
}
