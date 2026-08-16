/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const MAX_NATIVE_INTENT_RECONCILIATION_REMEDIATION_ROWS = 100;
const DEFAULT_NATIVE_INTENT_RECONCILIATION_REMEDIATION_ROWS = 50;

const NATIVE_INTENT_RECONCILIATION_REMEDIATION_ACTION_IDS = Object.freeze({
  DECLARE_LEGACY_POLICY_PURPOSE: 'declare_legacy_policy_purpose',
  REVIEW_POLICY_CONFIGURATION: 'review_policy_configuration',
  WAIT_FOR_SCHEDULER: 'wait_for_scheduler',
});

function asPositiveInteger(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null;
}

function asNonEmptyString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function toIsoTimestamp(value) {
  const timestamp = value instanceof Date ? value : new Date(value);
  return Number.isNaN(timestamp.getTime()) ? null : timestamp.toISOString();
}

function normalizeRemediationLimit(value) {
  if (value === undefined || value === null || value === '') {
    return DEFAULT_NATIVE_INTENT_RECONCILIATION_REMEDIATION_ROWS;
  }

  const numericValue = Number(value);
  if (!Number.isInteger(numericValue) || numericValue < 1) {
    return DEFAULT_NATIVE_INTENT_RECONCILIATION_REMEDIATION_ROWS;
  }

  return Math.min(numericValue, MAX_NATIVE_INTENT_RECONCILIATION_REMEDIATION_ROWS);
}

function buildAction(record = {}) {
  const canEditLegacyPolicy = record.legacy_configuration_present === true
    && record.native_authority_active !== true;
  const needsDeclaredPurpose = record.outcome_state === 'requires_maintenance'
    && record.candidate_status_id === 'no_convertible_intent'
    && record.reason_id === 'no_convertible_intent';

  if (needsDeclaredPurpose && canEditLegacyPolicy) {
    return {
      actionId: NATIVE_INTENT_RECONCILIATION_REMEDIATION_ACTION_IDS.DECLARE_LEGACY_POLICY_PURPOSE,
      available: true,
      title: 'Declare destination purpose',
      description: 'This existing policy has legacy configuration but no explicit destination identity. Review the policy and add only the Belongs Here rule that states what belongs in this library.',
      actionLabel: 'Review policy',
      schedulerFollowUp: 'After the policy is saved, the scheduler independently re-evaluates it. This page does not convert policies.',
    };
  }

  if (record.native_authority_active === true || record.legacy_configuration_present === true) {
    return {
      actionId: NATIVE_INTENT_RECONCILIATION_REMEDIATION_ACTION_IDS.REVIEW_POLICY_CONFIGURATION,
      available: canEditLegacyPolicy,
      title: 'Review policy configuration',
      description: 'The current reconciliation state needs a policy-specific review. Classifarr does not infer a destination purpose from the library name, history, profile, or AI output.',
      actionLabel: canEditLegacyPolicy ? 'Review policy' : null,
      schedulerFollowUp: 'Automatic reconciliation remains scheduler-owned after a supported policy update.',
    };
  }

  return {
    actionId: NATIVE_INTENT_RECONCILIATION_REMEDIATION_ACTION_IDS.WAIT_FOR_SCHEDULER,
    available: false,
    title: 'Scheduler follow-up required',
    description: 'Classifarr has no supported in-page remediation for the current state. Review the bounded status and wait for the protected scheduler lifecycle.',
    actionLabel: null,
    schedulerFollowUp: 'No policy, routing, provider, or queue state can be changed from this inventory.',
  };
}

function buildNativeIntentReconciliationRemediationEntry(record = {}) {
  const policyId = asPositiveInteger(record.policy_id);
  const libraryId = asPositiveInteger(record.library_id);
  if (!policyId || !libraryId) return null;

  const candidateStatusId = asNonEmptyString(record.candidate_status_id);
  const outcomeState = asNonEmptyString(record.outcome_state);
  const reasonId = asNonEmptyString(record.reason_id);
  if (!candidateStatusId || !outcomeState || !reasonId) return null;

  const normalizedRecord = {
    ...record,
    candidate_status_id: candidateStatusId,
    outcome_state: outcomeState,
    reason_id: reasonId,
  };

  return {
    policy: {
      id: policyId,
      name: asNonEmptyString(record.policy_name) || 'Unnamed policy',
    },
    library: {
      id: libraryId,
      name: asNonEmptyString(record.library_name) || 'Unnamed library',
      mediaType: asNonEmptyString(record.library_media_type),
    },
    reconciliation: {
      candidateStatusId,
      outcomeState,
      reasonId,
      evaluatedAt: toIsoTimestamp(record.evaluated_at),
    },
    action: buildAction(normalizedRecord),
  };
}

function buildNativeIntentReconciliationRemediationInventory({
  records = [],
  evaluatedAt = new Date(),
} = {}) {
  const entries = Array.isArray(records)
    ? records.map(buildNativeIntentReconciliationRemediationEntry).filter(Boolean)
    : [];

  return {
    version: 'native_intent_reconciliation_remediation_inventory.v1',
    evaluatedAt: toIsoTimestamp(evaluatedAt) || new Date().toISOString(),
    entries,
    summary: {
      unresolvedCount: entries.length,
      actionableCount: entries.filter(entry => entry.action.available).length,
    },
    rawPayloadExposed: false,
  };
}

export {
  DEFAULT_NATIVE_INTENT_RECONCILIATION_REMEDIATION_ROWS,
  MAX_NATIVE_INTENT_RECONCILIATION_REMEDIATION_ROWS,
  NATIVE_INTENT_RECONCILIATION_REMEDIATION_ACTION_IDS,
  buildNativeIntentReconciliationRemediationEntry,
  buildNativeIntentReconciliationRemediationInventory,
  normalizeRemediationLimit,
};
