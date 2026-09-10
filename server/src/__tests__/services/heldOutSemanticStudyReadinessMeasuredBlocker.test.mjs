/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { expect, test } from '@jest/globals';
import {
  buildHeldOutSemanticStudyLifecycleReauditSource,
  heldOutSemanticStudyLifecycleReauditSourceFingerprint,
} from '../../services/heldOutSemanticStudyLifecycleReauditContract.mjs';
import {
  buildHeldOutSemanticStudyLifecycleReauditPurposeEvidence,
} from '../../services/heldOutSemanticStudyLifecycleReauditPurposeEvidence.mjs';
import {
  buildHeldOutSemanticStudyReadinessMeasuredBlocker,
  HELD_OUT_SEMANTIC_STUDY_READINESS_MEASURED_BLOCKER_IDS,
} from '../../services/heldOutSemanticStudyReadinessMeasuredBlocker.mjs';

const lifecycleRecord = {
  normal_lifecycle_receipt_count: 1,
  initial_intent_establishment_count: 1,
  native_intent_change_count: 0,
  library_rebuild_replacement_count: 0,
};

const purposeEvidenceRecord = {
  active_policy_count: 1,
  authoritative_active_native_policy_count: 1,
  current_intent_version_policy_count: 1,
  current_intent_schema_version_policy_count: 1,
  retained_purpose_policy_count: 1,
  normal_lifecycle_receipt_policy_count: 1,
  verifiable_lifecycle_receipt_policy_count: 1,
  current_intent_lifecycle_receipt_policy_count: 1,
  current_intent_retained_purpose_lifecycle_receipt_policy_count: 1,
  complete_policy_evidence_count: 1,
};

function sourceFingerprint() {
  return heldOutSemanticStudyLifecycleReauditSourceFingerprint(
    buildHeldOutSemanticStudyLifecycleReauditSource(
      lifecycleRecord,
      buildHeldOutSemanticStudyLifecycleReauditPurposeEvidence(purposeEvidenceRecord),
    ),
  );
}

function currentAuditState(summary) {
  return {
    sourceFingerprint: sourceFingerprint(),
    auditStatusId: 'complete',
    auditReceipt: {
      version: 'policy.held_out_semantic_study_eligibility_audit.v6',
      status: { id: 'complete' },
      summary,
    },
  };
}

test('reports the exact governed-purpose blocker from a current aggregate audit only', () => {
  const blocker = buildHeldOutSemanticStudyReadinessMeasuredBlocker({
    sourceFingerprint: sourceFingerprint(),
    statusId: 'eligibility_audit_available',
    auditState: currentAuditState({
      comparisonEligibilityPartition: { comparisonCount: 24, eligibleComparisonCount: 0 },
      notPendingDecisionPartition: {
        reasonCounts: { no_qualifying_policy_evaluations: 24 },
      },
      policySourceScreen: {
        statusId: 'all_purpose_rules_excluded_as_inferred_profile',
      },
    }),
  });

  expect(blocker).toEqual({
    currentCompleteAuditAvailable: true,
    id: HELD_OUT_SEMANTIC_STUDY_READINESS_MEASURED_BLOCKER_IDS
      .GOVERNED_DECLARED_PURPOSE_EVIDENCE_REQUIRED,
  });
});

test('rejects stale, malformed, and incomplete receipts without exposing them', () => {
  const stale = currentAuditState({
    comparisonEligibilityPartition: { comparisonCount: 24, eligibleComparisonCount: 0 },
  });
  stale.sourceFingerprint = 'not-the-current-source';

  expect(buildHeldOutSemanticStudyReadinessMeasuredBlocker({
    sourceFingerprint: sourceFingerprint(),
    statusId: 'eligibility_audit_available',
    auditState: stale,
  })).toEqual({
    currentCompleteAuditAvailable: false,
    id: HELD_OUT_SEMANTIC_STUDY_READINESS_MEASURED_BLOCKER_IDS.AWAIT_PASSIVE_ELIGIBILITY_AUDIT,
  });
  expect(JSON.stringify(stale)).not.toMatch(/policy_id|library_id|tmdb|rule_value/u);
});

test('reports capture readiness only for a complete, internally consistent balanced audit', () => {
  const balancedSummary = {
    candidateCount: 28,
    candidateCountByStratum: {
      documentary: 7,
      'genre-overlap': 7,
      ordinary: 7,
      reality: 7,
    },
    eligibleCountByStratum: {
      documentary: 7,
      'genre-overlap': 7,
      ordinary: 7,
      reality: 7,
    },
  };
  const ready = buildHeldOutSemanticStudyReadinessMeasuredBlocker({
    sourceFingerprint: sourceFingerprint(),
    statusId: 'eligibility_audit_available',
    auditState: currentAuditState(balancedSummary),
  });
  const insufficient = buildHeldOutSemanticStudyReadinessMeasuredBlocker({
    sourceFingerprint: sourceFingerprint(),
    statusId: 'eligibility_audit_available',
    auditState: currentAuditState({
      ...balancedSummary,
      eligibleCountByStratum: { ...balancedSummary.eligibleCountByStratum, reality: 6 },
    }),
  });

  expect(ready).toEqual({
    currentCompleteAuditAvailable: true,
    id: HELD_OUT_SEMANTIC_STUDY_READINESS_MEASURED_BLOCKER_IDS.PRIVATE_COHORT_CAPTURE_READY,
  });
  expect(insufficient).toEqual({
    currentCompleteAuditAvailable: true,
    id: HELD_OUT_SEMANTIC_STUDY_READINESS_MEASURED_BLOCKER_IDS.AWAIT_BALANCED_ELIGIBLE_COHORT,
  });
  expect(JSON.stringify(ready)).not.toMatch(/tmdb|library|policy|title/u);
});

test('never advances a source prerequisite to a study action', () => {
  expect(buildHeldOutSemanticStudyReadinessMeasuredBlocker({
    statusId: 'complete_declared_purpose_evidence_required',
  })).toEqual({
    currentCompleteAuditAvailable: false,
    id: HELD_OUT_SEMANTIC_STUDY_READINESS_MEASURED_BLOCKER_IDS
      .COMPLETE_DECLARED_PURPOSE_EVIDENCE_REQUIRED,
  });
});
