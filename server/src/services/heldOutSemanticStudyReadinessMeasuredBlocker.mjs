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
  HELD_OUT_SEMANTIC_STUDY_ELIGIBILITY_AUDIT_STATUS_IDS,
  HELD_OUT_SEMANTIC_STUDY_ELIGIBILITY_AUDIT_VERSION,
} from './heldOutSemanticStudyEligibilityAuditContract.mjs';
import {
  HELD_OUT_SEMANTIC_STUDY_POLICY_SOURCE_SCREEN_STATUS_IDS,
} from './heldOutSemanticStudyPolicySourceScreen.mjs';
import {
  isHeldOutSemanticStudyPrivateCohortCaptureReady,
} from './heldOutSemanticStudyCohortCaptureReadiness.mjs';

export const HELD_OUT_SEMANTIC_STUDY_READINESS_MEASURED_BLOCKER_IDS = Object.freeze({
  AWAIT_PASSIVE_ELIGIBILITY_AUDIT: 'await_passive_eligibility_audit',
  AWAIT_QUALIFYING_POLICY_EVALUATIONS: 'await_qualifying_policy_evaluations',
  AWAIT_BALANCED_ELIGIBLE_COHORT: 'await_balanced_eligible_cohort',
  PRIVATE_COHORT_CAPTURE_READY: 'private_cohort_capture_ready',
  COMPLETE_DECLARED_PURPOSE_EVIDENCE_REQUIRED: 'complete_declared_purpose_evidence_required',
  GOVERNED_DECLARED_PURPOSE_EVIDENCE_REQUIRED: 'governed_declared_purpose_evidence_required',
  NORMAL_LIFECYCLE_RECEIPT_REQUIRED: 'normal_lifecycle_receipt_required',
  UNAVAILABLE: 'held_out_semantic_study_readiness_unavailable',
});

function nonNegativeInteger(value) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric >= 0 ? numeric : null;
}

function isCurrentCompleteAuditReceipt({ auditState, sourceFingerprint } = {}) {
  const receipt = auditState?.auditReceipt;
  return typeof sourceFingerprint === 'string' && sourceFingerprint.length > 0 &&
    auditState?.sourceFingerprint === sourceFingerprint &&
    auditState?.auditStatusId === HELD_OUT_SEMANTIC_STUDY_ELIGIBILITY_AUDIT_STATUS_IDS.COMPLETE &&
    receipt?.version === HELD_OUT_SEMANTIC_STUDY_ELIGIBILITY_AUDIT_VERSION &&
    receipt?.status?.id === HELD_OUT_SEMANTIC_STUDY_ELIGIBILITY_AUDIT_STATUS_IDS.COMPLETE &&
    receipt?.summary && typeof receipt.summary === 'object';
}

function isGovernedDeclaredPurposeEvidenceBlocker(receipt = {}) {
  const comparisonCount = nonNegativeInteger(
    receipt?.summary?.comparisonEligibilityPartition?.comparisonCount,
  );
  const eligibleComparisonCount = nonNegativeInteger(
    receipt?.summary?.comparisonEligibilityPartition?.eligibleComparisonCount,
  );
  const noQualifyingEvaluationCount = nonNegativeInteger(
    receipt?.summary?.notPendingDecisionPartition?.reasonCounts?.no_qualifying_policy_evaluations,
  );

  return comparisonCount !== null && comparisonCount > 0 &&
    eligibleComparisonCount === 0 &&
    noQualifyingEvaluationCount === comparisonCount &&
    receipt?.summary?.policySourceScreen?.statusId ===
      HELD_OUT_SEMANTIC_STUDY_POLICY_SOURCE_SCREEN_STATUS_IDS
        .ALL_PURPOSE_RULES_EXCLUDED_AS_INFERRED_PROFILE;
}

function isZeroEligibleComparisonAudit(receipt = {}) {
  const comparisonCount = nonNegativeInteger(
    receipt?.summary?.comparisonEligibilityPartition?.comparisonCount,
  );
  const eligibleComparisonCount = nonNegativeInteger(
    receipt?.summary?.comparisonEligibilityPartition?.eligibleComparisonCount,
  );

  return comparisonCount !== null && comparisonCount > 0 && eligibleComparisonCount === 0;
}

/**
 * Reduces the latest current aggregate audit to one passive next prerequisite.
 * It never returns an audit receipt, candidate, policy, library, provider, or
 * configuration value and it cannot authorize a cohort, labels, or routing.
 */
export function buildHeldOutSemanticStudyReadinessMeasuredBlocker({
  auditState = null,
  sourceFingerprint = null,
  statusId,
} = {}) {
  if (statusId === 'normal_lifecycle_receipt_required') {
    return Object.freeze({
      currentCompleteAuditAvailable: false,
      id: HELD_OUT_SEMANTIC_STUDY_READINESS_MEASURED_BLOCKER_IDS.NORMAL_LIFECYCLE_RECEIPT_REQUIRED,
    });
  }
  if (statusId === 'complete_declared_purpose_evidence_required') {
    return Object.freeze({
      currentCompleteAuditAvailable: false,
      id: HELD_OUT_SEMANTIC_STUDY_READINESS_MEASURED_BLOCKER_IDS
        .COMPLETE_DECLARED_PURPOSE_EVIDENCE_REQUIRED,
    });
  }
  if (statusId === 'held_out_semantic_study_readiness_unavailable') {
    return Object.freeze({
      currentCompleteAuditAvailable: false,
      id: HELD_OUT_SEMANTIC_STUDY_READINESS_MEASURED_BLOCKER_IDS.UNAVAILABLE,
    });
  }

  if (!isCurrentCompleteAuditReceipt({ auditState, sourceFingerprint })) {
    return Object.freeze({
      currentCompleteAuditAvailable: false,
      id: HELD_OUT_SEMANTIC_STUDY_READINESS_MEASURED_BLOCKER_IDS.AWAIT_PASSIVE_ELIGIBILITY_AUDIT,
    });
  }

  if (isGovernedDeclaredPurposeEvidenceBlocker(auditState.auditReceipt)) {
    return Object.freeze({
      currentCompleteAuditAvailable: true,
      id: HELD_OUT_SEMANTIC_STUDY_READINESS_MEASURED_BLOCKER_IDS
        .GOVERNED_DECLARED_PURPOSE_EVIDENCE_REQUIRED,
    });
  }
  if (isZeroEligibleComparisonAudit(auditState.auditReceipt)) {
    return Object.freeze({
      currentCompleteAuditAvailable: true,
      id: HELD_OUT_SEMANTIC_STUDY_READINESS_MEASURED_BLOCKER_IDS
        .AWAIT_QUALIFYING_POLICY_EVALUATIONS,
    });
  }
  if (isHeldOutSemanticStudyPrivateCohortCaptureReady(auditState.auditReceipt)) {
    return Object.freeze({
      currentCompleteAuditAvailable: true,
      id: HELD_OUT_SEMANTIC_STUDY_READINESS_MEASURED_BLOCKER_IDS.PRIVATE_COHORT_CAPTURE_READY,
    });
  }

  return Object.freeze({
    currentCompleteAuditAvailable: true,
    id: HELD_OUT_SEMANTIC_STUDY_READINESS_MEASURED_BLOCKER_IDS
      .AWAIT_BALANCED_ELIGIBLE_COHORT,
  });
}
