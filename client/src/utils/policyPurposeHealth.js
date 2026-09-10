/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

export const POLICY_PURPOSE_HEALTH_STATUS_IDS = Object.freeze({
  READY: 'ready',
  ATTENTION_REQUIRED: 'attention_required',
  REVIEW_WINDOW_TRUNCATED: 'review_window_truncated',
  NO_ACTIVE_VALIDATED_NATIVE_POLICY: 'no_active_validated_native_policy',
})

const EXPECTED_VERSION = 'policy_purpose_health.v1'
const SUMMARY_KEYS = Object.freeze([
  'reviewedLibraryCount',
  'declaredPurposeLibraryCount',
  'missingPurposeLibraryCount',
  'competingDestinationLibraryCount',
  'profileDerivedPurposeLibraryCount',
  'unverifiedPurposeLibraryCount',
  'needsAttentionLibraryCount',
  'reviewWindowTruncated',
])

function hasOnlyKeys(value, expectedKeys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const actualKeys = Object.keys(value).sort()
  const allowedKeys = [...expectedKeys].sort()
  return actualKeys.length === allowedKeys.length && actualKeys.every((key, index) => key === allowedKeys[index])
}

function isNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0
}

function isSummaryInternallyConsistent(summary, statusId) {
  const reviewedCount = summary.reviewedLibraryCount
  const counts = SUMMARY_KEYS
    .filter((key) => key !== 'reviewWindowTruncated')
    .map((key) => summary[key])

  if (!counts.every(isNonNegativeInteger) || counts.some((count) => count > reviewedCount)) return false
  if (summary.declaredPurposeLibraryCount + summary.needsAttentionLibraryCount < reviewedCount) return false

  if (statusId === POLICY_PURPOSE_HEALTH_STATUS_IDS.NO_ACTIVE_VALIDATED_NATIVE_POLICY) {
    return reviewedCount === 0 && summary.needsAttentionLibraryCount === 0 && !summary.reviewWindowTruncated
  }
  if (statusId === POLICY_PURPOSE_HEALTH_STATUS_IDS.REVIEW_WINDOW_TRUNCATED) {
    return reviewedCount > 0 && summary.reviewWindowTruncated
  }
  if (statusId === POLICY_PURPOSE_HEALTH_STATUS_IDS.ATTENTION_REQUIRED) {
    return reviewedCount > 0 && !summary.reviewWindowTruncated && summary.needsAttentionLibraryCount > 0
  }
  return reviewedCount > 0 && !summary.reviewWindowTruncated && summary.needsAttentionLibraryCount === 0
}

/**
 * Accepts only the fixed aggregate schema used by the Command Center. Keeping
 * this narrow prevents an accidental server expansion from being rendered or
 * retained by the browser as purpose-health content.
 */
export function parsePolicyPurposeHealth(value) {
  const expectedKeys = [
    'version',
    'statusId',
    'summary',
    'rawPurposeRulesExposed',
    'libraryIdentityExposed',
    'policyIdentityExposed',
    'observedOutcomeDataExposed',
    'semanticSelectionAffected',
    'routingAffected',
  ]

  if (!hasOnlyKeys(value, expectedKeys) || value.version !== EXPECTED_VERSION) return null
  if (!Object.values(POLICY_PURPOSE_HEALTH_STATUS_IDS).includes(value.statusId)) return null
  if (!hasOnlyKeys(value.summary, SUMMARY_KEYS)) return null
  if (typeof value.summary.reviewWindowTruncated !== 'boolean') return null
  if (
    value.rawPurposeRulesExposed !== false ||
    value.libraryIdentityExposed !== false ||
    value.policyIdentityExposed !== false ||
    value.observedOutcomeDataExposed !== false ||
    value.semanticSelectionAffected !== false ||
    value.routingAffected !== false
  ) return null
  if (!isSummaryInternallyConsistent(value.summary, value.statusId)) return null

  return Object.freeze({
    version: value.version,
    statusId: value.statusId,
    summary: Object.freeze({ ...value.summary }),
    rawPurposeRulesExposed: false,
    libraryIdentityExposed: false,
    policyIdentityExposed: false,
    observedOutcomeDataExposed: false,
    semanticSelectionAffected: false,
    routingAffected: false,
  })
}
