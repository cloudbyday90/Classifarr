/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

export const POLICY_PURPOSE_EVIDENCE_INVENTORY_STATUS_IDS = Object.freeze({
  NO_ACTIVE_VALIDATED_NATIVE_POLICY: 'no_active_validated_native_policy',
  POLICY_EVIDENCE_INCOMPLETE: 'policy_evidence_incomplete',
  COMPLETE_POLICY_EVIDENCE_AVAILABLE: 'complete_policy_evidence_available',
})

const VALID_STATUS_IDS = new Set(Object.values(POLICY_PURPOSE_EVIDENCE_INVENTORY_STATUS_IDS))

function nonNegativeCount(value) {
  const count = Number(value)
  return Number.isInteger(count) && count >= 0 ? count : 0
}

function boundedCount(value, maximum) {
  return Math.min(maximum, nonNegativeCount(value))
}

export function normalizePolicyPurposeEvidenceInventory(value) {
  if (!value || typeof value !== 'object') return null
  if (
    value.rawConfigurationExposed !== false ||
    value.semanticCohortReady !== false ||
    value.semanticSelectionAffected !== false ||
    value.routingAffected !== false
  ) return null

  const activePolicyCount = nonNegativeCount(value.activePolicyCount)
  const authoritativeActiveNativePolicyCount = boundedCount(
    value.authoritativeActiveNativePolicyCount,
    activePolicyCount,
  )
  const currentIntentVersionPolicyCount = boundedCount(
    value.currentIntentVersionPolicyCount,
    authoritativeActiveNativePolicyCount,
  )
  const currentIntentSchemaVersionPolicyCount = boundedCount(
    value.currentIntentSchemaVersionPolicyCount,
    currentIntentVersionPolicyCount,
  )
  const retainedDeclaredPurposePolicyCount = boundedCount(
    value.retainedDeclaredPurposePolicyCount,
    currentIntentSchemaVersionPolicyCount,
  )
  const normalLifecycleReceiptPolicyCount = boundedCount(
    value.normalLifecycleReceiptPolicyCount,
    authoritativeActiveNativePolicyCount,
  )
  const verifiableLifecycleReceiptPolicyCount = boundedCount(
    value.verifiableLifecycleReceiptPolicyCount,
    normalLifecycleReceiptPolicyCount,
  )
  const currentIntentLifecycleReceiptPolicyCount = boundedCount(
    value.currentIntentLifecycleReceiptPolicyCount,
    verifiableLifecycleReceiptPolicyCount,
  )
  const completePolicyEvidenceCount = boundedCount(
    value.completePolicyEvidenceCount,
    Math.min(retainedDeclaredPurposePolicyCount, currentIntentLifecycleReceiptPolicyCount),
  )
  const incompletePolicyEvidenceCount = activePolicyCount - completePolicyEvidenceCount
  const completePolicyEvidenceAvailable = completePolicyEvidenceCount > 0
  const expectedStatusId = activePolicyCount === 0
    ? POLICY_PURPOSE_EVIDENCE_INVENTORY_STATUS_IDS.NO_ACTIVE_VALIDATED_NATIVE_POLICY
    : completePolicyEvidenceAvailable
      ? POLICY_PURPOSE_EVIDENCE_INVENTORY_STATUS_IDS.COMPLETE_POLICY_EVIDENCE_AVAILABLE
      : POLICY_PURPOSE_EVIDENCE_INVENTORY_STATUS_IDS.POLICY_EVIDENCE_INCOMPLETE

  if (!VALID_STATUS_IDS.has(value.statusId) || value.statusId !== expectedStatusId) return null

  return {
    statusId: expectedStatusId,
    activePolicyCount,
    authoritativeActiveNativePolicyCount,
    currentIntentVersionPolicyCount,
    currentIntentSchemaVersionPolicyCount,
    retainedDeclaredPurposePolicyCount,
    normalLifecycleReceiptPolicyCount,
    verifiableLifecycleReceiptPolicyCount,
    currentIntentLifecycleReceiptPolicyCount,
    completePolicyEvidenceCount,
    incompletePolicyEvidenceCount,
    completePolicyEvidenceAvailable,
    rawConfigurationExposed: false,
    semanticCohortReady: false,
    semanticSelectionAffected: false,
    routingAffected: false,
  }
}
