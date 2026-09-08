/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
  buildPolicyPurposeCoverageProvenance,
  POLICY_PURPOSE_COVERAGE_PROVENANCE_STATUS_IDS,
} from './policyPurposeCoverageProvenance.mjs';

export const POLICY_PURPOSE_LIFECYCLE_PROVENANCE_RECEIPT_VERSION = 1;
export const DEFAULT_POLICY_PURPOSE_LIFECYCLE_PROVENANCE_RECEIPT_ROWS = 100;

export const POLICY_PURPOSE_LIFECYCLE_PROVENANCE_RECEIPT_STATUS_IDS = Object.freeze({
  NO_RECORDED_NORMAL_LIFECYCLE: 'no_recorded_normal_lifecycle',
  DECLARED_PURPOSE_RETAINED_FOR_OBSERVED_INITIAL_ESTABLISHMENTS:
    'declared_purpose_retained_for_observed_initial_establishments',
  DECLARED_PURPOSE_RETAINED_FOR_OBSERVED_LIFECYCLE_RECEIPTS:
    'declared_purpose_retained_for_observed_lifecycle_receipts',
  NORMAL_LIFECYCLE_RECEIPT_VERIFICATION_REQUIRED:
    'normal_lifecycle_receipt_verification_required',
  NORMAL_LIFECYCLE_HISTORY_TRUNCATED: 'normal_lifecycle_history_truncated',
  PURPOSE_RETENTION_REVIEW_REQUIRED: 'purpose_retention_review_required',
});

const NORMAL_LIFECYCLE_TRANSITION_IDS = Object.freeze({
  INITIAL_INTENT_ESTABLISHMENT: 'initial_intent_establishment',
  NATIVE_INTENT_CHANGE: 'native_intent_change',
});

function asNonNegativeInteger(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue >= 0 ? numericValue : 0;
}

function isKnownTransition(value) {
  return Object.values(NORMAL_LIFECYCLE_TRANSITION_IDS).includes(value);
}

function isIntentAvailable(record) {
  return record?.intent_available === true;
}

function buildLifecycleReceiptEntry(record = {}) {
  const intentAvailable = isIntentAvailable(record);
  const provenance = intentAvailable
    ? buildPolicyPurposeCoverageProvenance(record)
    : null;

  return {
    transitionId: isKnownTransition(record.lifecycle_transition)
      ? record.lifecycle_transition
      : null,
    intentAvailable,
    provenance,
  };
}

/**
 * Reduces durable normal authoring receipts to fixed provenance counts. The
 * supplied records are aggregate rule counts only: policy IDs, intent IDs,
 * authors, fingerprints, timestamps, configured values, profile values, and
 * media data never cross this contract boundary.
 */
export function buildPolicyPurposeLifecycleProvenanceReceipt({
  records = [],
  limit = DEFAULT_POLICY_PURPOSE_LIFECYCLE_PROVENANCE_RECEIPT_ROWS,
  truncated = false,
} = {}) {
  const entries = Array.isArray(records)
    ? records.map(buildLifecycleReceiptEntry)
    : [];
  const normalLifecycleReceiptCount = entries.length;
  const initialIntentEstablishmentCount = entries.filter((entry) => (
    entry.transitionId === NORMAL_LIFECYCLE_TRANSITION_IDS.INITIAL_INTENT_ESTABLISHMENT
  )).length;
  const nativeIntentChangeCount = entries.filter((entry) => (
    entry.transitionId === NORMAL_LIFECYCLE_TRANSITION_IDS.NATIVE_INTENT_CHANGE
  )).length;
  const verifiableReceiptCount = entries.filter((entry) => entry.intentAvailable).length;
  const unverifiableReceiptCount = normalLifecycleReceiptCount - verifiableReceiptCount;
  const retainedPurposeReceiptCount = entries.filter((entry) => (
    entry.provenance?.statusId === (
      POLICY_PURPOSE_COVERAGE_PROVENANCE_STATUS_IDS.RETAINED_SPECIALIZED_PURPOSE_AVAILABLE
    )
  )).length;
  const profileOnlyPurposeReceiptCount = entries.filter((entry) => (
    entry.provenance?.statusId === (
      POLICY_PURPOSE_COVERAGE_PROVENANCE_STATUS_IDS.PROFILE_ONLY_SPECIALIZED_PURPOSE
    )
  )).length;
  const noSpecializedPurposeReceiptCount = entries.filter((entry) => (
    entry.provenance?.statusId === (
      POLICY_PURPOSE_COVERAGE_PROVENANCE_STATUS_IDS.NO_SPECIALIZED_PURPOSE
    )
  )).length;
  const normalizedLimit = Math.max(1, asNonNegativeInteger(limit) || (
    DEFAULT_POLICY_PURPOSE_LIFECYCLE_PROVENANCE_RECEIPT_ROWS
  ));
  const fullHistoryObserved = truncated !== true;
  const retainedForEveryVerifiableReceipt = verifiableReceiptCount > 0 &&
    retainedPurposeReceiptCount === verifiableReceiptCount;

  const statusId = normalLifecycleReceiptCount === 0
    ? POLICY_PURPOSE_LIFECYCLE_PROVENANCE_RECEIPT_STATUS_IDS.NO_RECORDED_NORMAL_LIFECYCLE
    : unverifiableReceiptCount > 0
      ? POLICY_PURPOSE_LIFECYCLE_PROVENANCE_RECEIPT_STATUS_IDS
        .NORMAL_LIFECYCLE_RECEIPT_VERIFICATION_REQUIRED
      : !fullHistoryObserved
        ? POLICY_PURPOSE_LIFECYCLE_PROVENANCE_RECEIPT_STATUS_IDS
          .NORMAL_LIFECYCLE_HISTORY_TRUNCATED
      : retainedForEveryVerifiableReceipt && nativeIntentChangeCount === 0
        ? POLICY_PURPOSE_LIFECYCLE_PROVENANCE_RECEIPT_STATUS_IDS
          .DECLARED_PURPOSE_RETAINED_FOR_OBSERVED_INITIAL_ESTABLISHMENTS
        : retainedForEveryVerifiableReceipt
          ? POLICY_PURPOSE_LIFECYCLE_PROVENANCE_RECEIPT_STATUS_IDS
            .DECLARED_PURPOSE_RETAINED_FOR_OBSERVED_LIFECYCLE_RECEIPTS
          : POLICY_PURPOSE_LIFECYCLE_PROVENANCE_RECEIPT_STATUS_IDS
            .PURPOSE_RETENTION_REVIEW_REQUIRED;

  return {
    version: `policy_purpose_lifecycle_provenance_receipt.v${
      POLICY_PURPOSE_LIFECYCLE_PROVENANCE_RECEIPT_VERSION
    }`,
    statusId,
    scope: {
      observedReceiptCount: normalLifecycleReceiptCount,
      receiptLimit: normalizedLimit,
      truncated: truncated === true,
      fullHistoryObserved,
    },
    summary: {
      normalLifecycleReceiptCount,
      initialIntentEstablishmentCount,
      nativeIntentChangeCount,
      verifiableReceiptCount,
      unverifiableReceiptCount,
      retainedPurposeReceiptCount,
      profileOnlyPurposeReceiptCount,
      noSpecializedPurposeReceiptCount,
      retainedForEveryVerifiableReceipt,
      normalPolicyChangeObserved: nativeIntentChangeCount > 0,
      normalPolicyChangeRetentionVerified: fullHistoryObserved &&
        nativeIntentChangeCount > 0 &&
        unverifiableReceiptCount === 0 &&
        retainedForEveryVerifiableReceipt,
    },
    rawConfigurationExposed: false,
    semanticCohortReady: false,
    semanticSelectionAffected: false,
    labelingAffected: false,
    routingAffected: false,
  };
}
