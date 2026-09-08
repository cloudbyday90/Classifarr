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
  buildHeldOutSemanticStudyLifecycleReauditSource,
  heldOutSemanticStudyLifecycleReauditSourceFingerprint,
} from './heldOutSemanticStudyLifecycleReauditContract.mjs';
import {
  buildHeldOutSemanticStudyLifecycleReauditPurposeEvidence,
} from './heldOutSemanticStudyLifecycleReauditPurposeEvidence.mjs';
import {
  buildHeldOutSemanticStudyReadinessMeasuredBlocker,
  HELD_OUT_SEMANTIC_STUDY_READINESS_MEASURED_BLOCKER_IDS,
} from './heldOutSemanticStudyReadinessMeasuredBlocker.mjs';

export const HELD_OUT_SEMANTIC_STUDY_READINESS_VERSION =
  'policy.held_out_semantic_study_readiness.v4';

export const HELD_OUT_SEMANTIC_STUDY_READINESS_STATUS_IDS = Object.freeze({
  NORMAL_LIFECYCLE_RECEIPT_REQUIRED: 'normal_lifecycle_receipt_required',
  COMPLETE_DECLARED_PURPOSE_EVIDENCE_REQUIRED: 'complete_declared_purpose_evidence_required',
  ELIGIBILITY_AUDIT_AVAILABLE: 'eligibility_audit_available',
  UNAVAILABLE: 'held_out_semantic_study_readiness_unavailable',
});

export const HELD_OUT_SEMANTIC_STUDY_READINESS_RISK_IDS = Object.freeze({
  INVALID_VERSION: 'invalid_held_out_semantic_study_readiness_version',
  INVALID_STATUS: 'invalid_held_out_semantic_study_readiness_status',
  INVALID_COUNTS: 'invalid_held_out_semantic_study_readiness_counts',
  INVALID_PRECONDITION: 'invalid_held_out_semantic_study_readiness_precondition',
  UNSAFE_PROJECTION: 'unsafe_held_out_semantic_study_readiness_projection',
});

const READINESS_FIELDS = new Set([
  'version',
  'statusId',
  'normalLifecycleReceiptCount',
  'completePolicyEvidenceCount',
  'currentCompleteAuditAvailable',
  'measuredBlockerId',
  'reAuditPreconditionSatisfied',
  'rawConfigurationExposed',
  'libraryIdentityExposed',
  'mediaIdentityExposed',
  'semanticCohortReady',
  'independentLabelsAvailable',
  'semanticSelectionAffected',
  'routingAffected',
]);

function nonNegativeInteger(value) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric >= 0 ? numeric : 0;
}

function buildResult({
  statusId,
  normalLifecycleReceiptCount = 0,
  completePolicyEvidenceCount = 0,
  measuredBlocker,
} = {}) {
  const normalizedLifecycleCount = nonNegativeInteger(normalLifecycleReceiptCount);
  const normalizedPurposeCount = nonNegativeInteger(completePolicyEvidenceCount);
  const reAuditPreconditionSatisfied = statusId ===
    HELD_OUT_SEMANTIC_STUDY_READINESS_STATUS_IDS.ELIGIBILITY_AUDIT_AVAILABLE;

  return Object.freeze({
    version: HELD_OUT_SEMANTIC_STUDY_READINESS_VERSION,
    statusId,
    normalLifecycleReceiptCount: normalizedLifecycleCount,
    completePolicyEvidenceCount: normalizedPurposeCount,
    currentCompleteAuditAvailable: measuredBlocker?.currentCompleteAuditAvailable === true,
    measuredBlockerId: measuredBlocker?.id ??
      HELD_OUT_SEMANTIC_STUDY_READINESS_MEASURED_BLOCKER_IDS.UNAVAILABLE,
    reAuditPreconditionSatisfied,
    rawConfigurationExposed: false,
    libraryIdentityExposed: false,
    mediaIdentityExposed: false,
    semanticCohortReady: false,
    independentLabelsAvailable: false,
    semanticSelectionAffected: false,
    routingAffected: false,
  });
}

/**
 * Produces one fixed, aggregate-only report explaining whether the existing
 * private eligibility audit has its two source prerequisites. Availability is
 * not a cohort, label, accuracy, semantic-selection, or routing decision.
 */
export function buildHeldOutSemanticStudyReadiness({
  auditState = null,
  lifecycleRecord = {},
  purposeEvidenceRecord = {},
} = {}) {
  const lifecycle = buildHeldOutSemanticStudyLifecycleReauditSource(lifecycleRecord);
  const purposeEvidence = buildHeldOutSemanticStudyLifecycleReauditPurposeEvidence(
    purposeEvidenceRecord,
  );
  const normalLifecycleReceiptCount = lifecycle.normalLifecycleReceiptCount;
  const completePolicyEvidenceCount = purposeEvidence.completePolicyEvidenceCount;

  const buildReadinessResult = (statusId) => {
    const source = buildHeldOutSemanticStudyLifecycleReauditSource(lifecycleRecord, purposeEvidence);
    return buildResult({
      statusId,
      normalLifecycleReceiptCount,
      completePolicyEvidenceCount,
      measuredBlocker: buildHeldOutSemanticStudyReadinessMeasuredBlocker({
        auditState,
        sourceFingerprint: heldOutSemanticStudyLifecycleReauditSourceFingerprint(source),
        statusId,
      }),
    });
  };

  if (normalLifecycleReceiptCount === 0) {
    return buildReadinessResult(
      HELD_OUT_SEMANTIC_STUDY_READINESS_STATUS_IDS.NORMAL_LIFECYCLE_RECEIPT_REQUIRED,
    );
  }

  if (completePolicyEvidenceCount === 0) {
    return buildReadinessResult(
      HELD_OUT_SEMANTIC_STUDY_READINESS_STATUS_IDS
        .COMPLETE_DECLARED_PURPOSE_EVIDENCE_REQUIRED,
    );
  }

  return buildReadinessResult(
    HELD_OUT_SEMANTIC_STUDY_READINESS_STATUS_IDS.ELIGIBILITY_AUDIT_AVAILABLE,
  );
}

export function buildHeldOutSemanticStudyReadinessUnavailable() {
  return buildResult({
    statusId: HELD_OUT_SEMANTIC_STUDY_READINESS_STATUS_IDS.UNAVAILABLE,
  });
}

/** Validates the closed, read-only browser projection before it is returned. */
export function auditHeldOutSemanticStudyReadiness(value = {}) {
  const result = value && typeof value === 'object' ? value : {};
  const issues = [];
  const lifecycleCount = nonNegativeInteger(result.normalLifecycleReceiptCount);
  const purposeCount = nonNegativeInteger(result.completePolicyEvidenceCount);
  const statusId = result.statusId;

  if (result.version !== HELD_OUT_SEMANTIC_STUDY_READINESS_VERSION) {
    issues.push({ riskId: HELD_OUT_SEMANTIC_STUDY_READINESS_RISK_IDS.INVALID_VERSION });
  }
  if (!Object.values(HELD_OUT_SEMANTIC_STUDY_READINESS_STATUS_IDS).includes(statusId)) {
    issues.push({ riskId: HELD_OUT_SEMANTIC_STUDY_READINESS_RISK_IDS.INVALID_STATUS });
  }
  if (
    lifecycleCount !== result.normalLifecycleReceiptCount ||
    purposeCount !== result.completePolicyEvidenceCount
  ) {
    issues.push({ riskId: HELD_OUT_SEMANTIC_STUDY_READINESS_RISK_IDS.INVALID_COUNTS });
  }

  const expectedPrecondition = statusId ===
    HELD_OUT_SEMANTIC_STUDY_READINESS_STATUS_IDS.ELIGIBILITY_AUDIT_AVAILABLE;
  const expectedStatusId = lifecycleCount === 0
    ? HELD_OUT_SEMANTIC_STUDY_READINESS_STATUS_IDS.NORMAL_LIFECYCLE_RECEIPT_REQUIRED
    : purposeCount === 0
      ? HELD_OUT_SEMANTIC_STUDY_READINESS_STATUS_IDS.COMPLETE_DECLARED_PURPOSE_EVIDENCE_REQUIRED
      : HELD_OUT_SEMANTIC_STUDY_READINESS_STATUS_IDS.ELIGIBILITY_AUDIT_AVAILABLE;
  const statusMatchesCounts = statusId === HELD_OUT_SEMANTIC_STUDY_READINESS_STATUS_IDS.UNAVAILABLE
    ? lifecycleCount === 0 && purposeCount === 0
    : statusId === expectedStatusId;
  if (
    result.reAuditPreconditionSatisfied !== expectedPrecondition ||
    !statusMatchesCounts
  ) {
    issues.push({ riskId: HELD_OUT_SEMANTIC_STUDY_READINESS_RISK_IDS.INVALID_PRECONDITION });
  }
  const validMeasuredBlockerId = Object.values(
    HELD_OUT_SEMANTIC_STUDY_READINESS_MEASURED_BLOCKER_IDS,
  ).includes(result.measuredBlockerId);
  const sourceBlockerMatchesStatus = (
    statusId === HELD_OUT_SEMANTIC_STUDY_READINESS_STATUS_IDS.NORMAL_LIFECYCLE_RECEIPT_REQUIRED &&
    result.measuredBlockerId ===
      HELD_OUT_SEMANTIC_STUDY_READINESS_MEASURED_BLOCKER_IDS.NORMAL_LIFECYCLE_RECEIPT_REQUIRED &&
    result.currentCompleteAuditAvailable === false
  ) || (
    statusId === HELD_OUT_SEMANTIC_STUDY_READINESS_STATUS_IDS
      .COMPLETE_DECLARED_PURPOSE_EVIDENCE_REQUIRED &&
    result.measuredBlockerId === HELD_OUT_SEMANTIC_STUDY_READINESS_MEASURED_BLOCKER_IDS
      .COMPLETE_DECLARED_PURPOSE_EVIDENCE_REQUIRED &&
    result.currentCompleteAuditAvailable === false
  ) || (
    statusId === HELD_OUT_SEMANTIC_STUDY_READINESS_STATUS_IDS.UNAVAILABLE &&
    result.measuredBlockerId === HELD_OUT_SEMANTIC_STUDY_READINESS_MEASURED_BLOCKER_IDS.UNAVAILABLE &&
    result.currentCompleteAuditAvailable === false
  );
  const auditBlockerMatchesStatus = statusId ===
    HELD_OUT_SEMANTIC_STUDY_READINESS_STATUS_IDS.ELIGIBILITY_AUDIT_AVAILABLE && (
    (result.measuredBlockerId ===
      HELD_OUT_SEMANTIC_STUDY_READINESS_MEASURED_BLOCKER_IDS.AWAIT_PASSIVE_ELIGIBILITY_AUDIT &&
      result.currentCompleteAuditAvailable === false) ||
    ([
      HELD_OUT_SEMANTIC_STUDY_READINESS_MEASURED_BLOCKER_IDS
        .GOVERNED_DECLARED_PURPOSE_EVIDENCE_REQUIRED,
      HELD_OUT_SEMANTIC_STUDY_READINESS_MEASURED_BLOCKER_IDS
        .AWAIT_QUALIFYING_POLICY_EVALUATIONS,
      HELD_OUT_SEMANTIC_STUDY_READINESS_MEASURED_BLOCKER_IDS.AWAIT_BALANCED_ELIGIBLE_COHORT,
    ].includes(result.measuredBlockerId) && result.currentCompleteAuditAvailable === true)
  );
  if (!validMeasuredBlockerId || (!sourceBlockerMatchesStatus && !auditBlockerMatchesStatus)) {
    issues.push({ riskId: HELD_OUT_SEMANTIC_STUDY_READINESS_RISK_IDS.INVALID_PRECONDITION });
  }
  if (
    result.rawConfigurationExposed !== false ||
    result.libraryIdentityExposed !== false ||
    result.mediaIdentityExposed !== false ||
    result.semanticCohortReady !== false ||
    result.independentLabelsAvailable !== false ||
    result.semanticSelectionAffected !== false ||
    result.routingAffected !== false
  ) {
    issues.push({ riskId: HELD_OUT_SEMANTIC_STUDY_READINESS_RISK_IDS.UNSAFE_PROJECTION });
  }
  if (Object.keys(result).some(key => !READINESS_FIELDS.has(key))) {
    issues.push({ riskId: HELD_OUT_SEMANTIC_STUDY_READINESS_RISK_IDS.UNSAFE_PROJECTION });
  }

  return Object.freeze({ ok: issues.length === 0, issueCount: issues.length, issues });
}
