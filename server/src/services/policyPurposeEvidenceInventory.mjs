/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

export const POLICY_PURPOSE_EVIDENCE_INVENTORY_VERSION = 3;

export const POLICY_PURPOSE_EVIDENCE_INVENTORY_STATUS_IDS = Object.freeze({
  NO_ACTIVE_VALIDATED_NATIVE_POLICY: 'no_active_validated_native_policy',
  POLICY_EVIDENCE_INCOMPLETE: 'policy_evidence_incomplete',
  COMPLETE_POLICY_EVIDENCE_AVAILABLE: 'complete_policy_evidence_available',
});

function asNonNegativeInteger(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue >= 0 ? numericValue : 0;
}

function boundedCount(value, maximum) {
  return Math.min(maximum, asNonNegativeInteger(value));
}

/**
 * Converts library- and configuration-agnostic database counts into a fixed
 * inventory of policy-evidence availability. It is advisory: no member of the
 * inventory establishes semantic correctness, study eligibility, labeling, or
 * routing authority.
 */
export function buildPolicyPurposeEvidenceInventory(record = {}) {
  const activePolicyCount = asNonNegativeInteger(record.active_policy_count);
  const authoritativeActiveNativePolicyCount = boundedCount(
    record.authoritative_active_native_policy_count,
    activePolicyCount,
  );
  const currentIntentVersionPolicyCount = boundedCount(
    record.current_intent_version_policy_count,
    authoritativeActiveNativePolicyCount,
  );
  const currentIntentSchemaVersionPolicyCount = boundedCount(
    record.current_intent_schema_version_policy_count,
    currentIntentVersionPolicyCount,
  );
  const retainedDeclaredPurposePolicyCount = boundedCount(
    record.retained_purpose_policy_count,
    currentIntentSchemaVersionPolicyCount,
  );
  const normalLifecycleReceiptPolicyCount = boundedCount(
    record.normal_lifecycle_receipt_policy_count,
    authoritativeActiveNativePolicyCount,
  );
  const verifiableLifecycleReceiptPolicyCount = boundedCount(
    record.verifiable_lifecycle_receipt_policy_count,
    normalLifecycleReceiptPolicyCount,
  );
  const currentIntentLifecycleReceiptPolicyCount = boundedCount(
    record.current_intent_lifecycle_receipt_policy_count,
    verifiableLifecycleReceiptPolicyCount,
  );
  const currentIntentRetainedPurposeLifecycleReceiptPolicyCount = boundedCount(
    record.current_intent_retained_purpose_lifecycle_receipt_policy_count,
    Math.min(
      retainedDeclaredPurposePolicyCount,
      currentIntentLifecycleReceiptPolicyCount,
    ),
  );
  const completePolicyEvidenceCount = boundedCount(
    record.complete_policy_evidence_count,
    Math.min(
      retainedDeclaredPurposePolicyCount,
      currentIntentLifecycleReceiptPolicyCount,
      currentIntentRetainedPurposeLifecycleReceiptPolicyCount,
    ),
  );
  const incompletePolicyEvidenceCount = activePolicyCount - completePolicyEvidenceCount;
  const completePolicyEvidenceAvailable = completePolicyEvidenceCount > 0;

  const statusId = activePolicyCount === 0
    ? POLICY_PURPOSE_EVIDENCE_INVENTORY_STATUS_IDS.NO_ACTIVE_VALIDATED_NATIVE_POLICY
    : completePolicyEvidenceAvailable
      ? POLICY_PURPOSE_EVIDENCE_INVENTORY_STATUS_IDS.COMPLETE_POLICY_EVIDENCE_AVAILABLE
      : POLICY_PURPOSE_EVIDENCE_INVENTORY_STATUS_IDS.POLICY_EVIDENCE_INCOMPLETE;

  return {
    version: `policy_purpose_evidence_inventory.v${POLICY_PURPOSE_EVIDENCE_INVENTORY_VERSION}`,
    statusId,
    activePolicyCount,
    authoritativeActiveNativePolicyCount,
    currentIntentVersionPolicyCount,
    currentIntentSchemaVersionPolicyCount,
    retainedDeclaredPurposePolicyCount,
    normalLifecycleReceiptPolicyCount,
    verifiableLifecycleReceiptPolicyCount,
    currentIntentLifecycleReceiptPolicyCount,
    currentIntentRetainedPurposeLifecycleReceiptPolicyCount,
    completePolicyEvidenceCount,
    incompletePolicyEvidenceCount,
    completePolicyEvidenceAvailable,
    rawConfigurationExposed: false,
    semanticCohortReady: false,
    semanticSelectionAffected: false,
    routingAffected: false,
  };
}
