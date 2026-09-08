/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { expect, test } from '@jest/globals';
import {
  auditHeldOutSemanticStudyReadiness,
  buildHeldOutSemanticStudyReadiness,
  buildHeldOutSemanticStudyReadinessUnavailable,
  HELD_OUT_SEMANTIC_STUDY_READINESS_STATUS_IDS,
} from '../../services/heldOutSemanticStudyReadiness.mjs';

function lifecycleRecord({ initial = 0, changed = 0, rebuild = 0 } = {}) {
  return {
    normal_lifecycle_receipt_count: initial + changed + rebuild,
    initial_intent_establishment_count: initial,
    native_intent_change_count: changed,
    library_rebuild_replacement_count: rebuild,
  };
}

function completePurposeEvidenceRecord(count = 0) {
  return {
    active_policy_count: count,
    authoritative_active_native_policy_count: count,
    current_intent_version_policy_count: count,
    current_intent_schema_version_policy_count: count,
    retained_purpose_policy_count: count,
    normal_lifecycle_receipt_policy_count: count,
    verifiable_lifecycle_receipt_policy_count: count,
    current_intent_lifecycle_receipt_policy_count: count,
    current_intent_retained_purpose_lifecycle_receipt_policy_count: count,
    complete_policy_evidence_count: count,
  };
}

test('reports the lifecycle prerequisite without disclosing source identities', () => {
  const report = buildHeldOutSemanticStudyReadiness({
    lifecycleRecord: lifecycleRecord(),
    purposeEvidenceRecord: completePurposeEvidenceRecord(4),
  });

  expect(report).toEqual(expect.objectContaining({
    statusId: HELD_OUT_SEMANTIC_STUDY_READINESS_STATUS_IDS.NORMAL_LIFECYCLE_RECEIPT_REQUIRED,
    normalLifecycleReceiptCount: 0,
    completePolicyEvidenceCount: 4,
    reAuditPreconditionSatisfied: false,
    rawConfigurationExposed: false,
    libraryIdentityExposed: false,
    mediaIdentityExposed: false,
    semanticCohortReady: false,
    independentLabelsAvailable: false,
    semanticSelectionAffected: false,
    routingAffected: false,
  }));
  expect(JSON.stringify(report)).not.toMatch(/policy_id|library_id|tmdb|rule_value/u);
  expect(auditHeldOutSemanticStudyReadiness(report)).toEqual(expect.objectContaining({ ok: true }));
});

test('reports declared-purpose evidence before allowing a private eligibility audit', () => {
  const deferred = buildHeldOutSemanticStudyReadiness({
    lifecycleRecord: lifecycleRecord({ changed: 2 }),
    purposeEvidenceRecord: completePurposeEvidenceRecord(),
  });
  const available = buildHeldOutSemanticStudyReadiness({
    lifecycleRecord: lifecycleRecord({ initial: 1 }),
    purposeEvidenceRecord: completePurposeEvidenceRecord(1),
  });

  expect(deferred).toEqual(expect.objectContaining({
    statusId: HELD_OUT_SEMANTIC_STUDY_READINESS_STATUS_IDS
      .COMPLETE_DECLARED_PURPOSE_EVIDENCE_REQUIRED,
    reAuditPreconditionSatisfied: false,
  }));
  expect(available).toEqual(expect.objectContaining({
    statusId: HELD_OUT_SEMANTIC_STUDY_READINESS_STATUS_IDS.ELIGIBILITY_AUDIT_AVAILABLE,
    reAuditPreconditionSatisfied: true,
    semanticCohortReady: false,
    semanticSelectionAffected: false,
    routingAffected: false,
  }));
});

test('fails closed for a contradictory report and produces a closed unavailable result', () => {
  const invalid = {
    ...buildHeldOutSemanticStudyReadiness({
      lifecycleRecord: lifecycleRecord({ initial: 1 }),
      purposeEvidenceRecord: completePurposeEvidenceRecord(1),
    }),
    completePolicyEvidenceCount: 0,
  };

  expect(auditHeldOutSemanticStudyReadiness(invalid)).toEqual(expect.objectContaining({
    ok: false,
  }));
  expect(auditHeldOutSemanticStudyReadiness({
    ...buildHeldOutSemanticStudyReadiness({
      lifecycleRecord: lifecycleRecord({ initial: 1 }),
      purposeEvidenceRecord: completePurposeEvidenceRecord(1),
    }),
    libraryName: 'must-not-project',
  })).toEqual(expect.objectContaining({ ok: false }));
  expect(buildHeldOutSemanticStudyReadinessUnavailable()).toEqual(expect.objectContaining({
    statusId: HELD_OUT_SEMANTIC_STUDY_READINESS_STATUS_IDS.UNAVAILABLE,
    normalLifecycleReceiptCount: 0,
    completePolicyEvidenceCount: 0,
    reAuditPreconditionSatisfied: false,
  }));
});
