/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import {
  POLICY_COMPATIBILITY_DELETION_CURRENT_INVENTORY_STATUS_IDS,
  POLICY_COMPATIBILITY_DELETION_CURRENT_INVENTORY_VERSION,
} from '../../services/policyCompatibilityDeletionCurrentInventory.mjs';
import {
  POLICY_COMPATIBILITY_DELETION_GATES_VERSION,
} from '../../services/policyCompatibilityDeletionGates.mjs';
import {
  buildPolicyCompatibilityDeletionExecutionPlanEvidenceBundle,
} from '../../services/policyCompatibilityDeletionExecutionPlanEvidenceBundle.mjs';
import {
  POLICY_COMPATIBILITY_DELETION_RECONCILIATION_STATE_INVENTORY_STATUS_IDS,
  POLICY_COMPATIBILITY_DELETION_RECONCILIATION_STATE_INVENTORY_VERSION,
} from '../../services/policyCompatibilityDeletionReconciliationStateInventory.mjs';
import {
  POLICY_COMPATIBILITY_DELETION_RELEASE_REVIEW_ARTIFACT_RISK_IDS,
  POLICY_COMPATIBILITY_DELETION_RELEASE_REVIEW_ARTIFACT_STATUS_IDS,
  buildPolicyCompatibilityDeletionReleaseReviewArtifact,
  validatePolicyCompatibilityDeletionReleaseReviewArtifact,
} from '../../services/policyCompatibilityDeletionReleaseReviewArtifact.mjs';
import {
  buildReadyPolicyCompatibilityDeletionReleasePrerequisiteEvidence,
} from '../helpers/policyCompatibilityDeletionReleasePrerequisiteEvidence.mjs';
import {
  POLICY_NATIVE_RUNTIME_CUTOVER_STATUS_IDS,
  POLICY_NATIVE_RUNTIME_CUTOVER_VERIFICATION_VERSION,
} from '../../services/policyNativeRuntimeCutoverVerification.mjs';
import {
  buildPolicyBackupRestoreVerificationEvidence,
} from '../../services/policyBackupRestoreVerificationEvidence.mjs';

const EVIDENCE_TIME = '2026-08-22T12:00:00.000Z';

function readyEvidenceBundle() {
  const evidence = {
    currentPolicyInventory: {
      version: POLICY_COMPATIBILITY_DELETION_CURRENT_INVENTORY_VERSION,
      generatedAt: EVIDENCE_TIME,
      statusId:
        POLICY_COMPATIBILITY_DELETION_CURRENT_INVENTORY_STATUS_IDS
          .ALL_ENABLED_POLICIES_NATIVE,
      allEnabledPoliciesNative: true,
      policyCounts: { unconvertedPolicyCount: 0 },
      validation: { ok: true },
    },
    reconciliationStateInventory: {
      version: POLICY_COMPATIBILITY_DELETION_RECONCILIATION_STATE_INVENTORY_VERSION,
      generatedAt: EVIDENCE_TIME,
      statusId:
        POLICY_COMPATIBILITY_DELETION_RECONCILIATION_STATE_INVENTORY_STATUS_IDS
          .NO_REQUIRES_MAINTENANCE_STATES,
      hasNoRequiresMaintenanceStates: true,
      requiresMaintenanceStateCount: 0,
      validation: { ok: true },
    },
    cutoverVerification: {
      version: POLICY_NATIVE_RUNTIME_CUTOVER_VERIFICATION_VERSION,
      generatedAt: EVIDENCE_TIME,
      statusId: POLICY_NATIVE_RUNTIME_CUTOVER_STATUS_IDS.READY_FOR_CUTOVER_MONITORING,
      validation: { ok: true },
    },
    deletionGatePlan: {
      version: POLICY_COMPATIBILITY_DELETION_GATES_VERSION,
      generatedAt: EVIDENCE_TIME,
      statusId: 'ready_to_delete',
      readyToDelete: true,
      unconvertedPolicyCount: 0,
      requiresMaintenanceStateCount: 0,
      validation: { ok: true },
    },
    backupRestoreEvidence: buildPolicyBackupRestoreVerificationEvidence({
      generatedAt: EVIDENCE_TIME,
      record: {
        verification_version: 1,
        restore_mode: 'replace',
        backup_version: '2.0',
        verification_status: 'verified',
        schema_parity_verified: true,
        native_authority_verified: true,
        policy_library_mismatch_count: 0,
        verified_at: EVIDENCE_TIME,
        restore_gate_state: 'ready',
        restore_gate_reason_id: 'restore_verified',
        restore_gate_verified_at: EVIDENCE_TIME,
      },
    }),
  };

  return buildPolicyCompatibilityDeletionExecutionPlanEvidenceBundle({
    ...evidence,
    generatedAt: EVIDENCE_TIME,
    now: EVIDENCE_TIME,
    releasePrerequisiteEvidence:
      buildReadyPolicyCompatibilityDeletionReleasePrerequisiteEvidence(evidence, {
        generatedAt: EVIDENCE_TIME,
      }),
  });
}

describe('policyCompatibilityDeletionReleaseReviewArtifact', () => {
  test('creates a fresh, fingerprint-bound review request without manufacturing approval', () => {
    const artifact = buildPolicyCompatibilityDeletionReleaseReviewArtifact({
      executionPlanEvidenceBundle: readyEvidenceBundle(),
      generatedAt: EVIDENCE_TIME,
      now: EVIDENCE_TIME,
    });

    expect(artifact).toEqual(expect.objectContaining({
      statusId:
        POLICY_COMPATIBILITY_DELETION_RELEASE_REVIEW_ARTIFACT_STATUS_IDS.REVIEW_REQUIRED,
      reviewRequired: true,
      reviewRequirements: expect.objectContaining({
        approvalIsNotAutomatic: true,
        requiredSubjectType: 'release_operator',
      }),
      validation: expect.objectContaining({ ok: true }),
    }));
    expect(artifact.reviewRequirements.attestations).toEqual([
      { prerequisiteId: 'rollback_support', requiredStatusId: 'verified' },
      { prerequisiteId: 'support_diagnostics', requiredStatusId: 'verified' },
      { prerequisiteId: 'deletion_manifest_approval', requiredStatusId: 'approved' },
    ]);
    expect(JSON.stringify(artifact)).not.toContain('operator:release');
    expect(Object.values(artifact.sideEffects).some(Boolean)).toBe(false);
  });

  test('blocks a request when the supplied context fingerprint no longer matches the bundle', () => {
    const evidenceBundle = readyEvidenceBundle();
    evidenceBundle.deletionReadiness.releasePrerequisiteContextFingerprint.fingerprint =
      '0'.repeat(64);

    const artifact = buildPolicyCompatibilityDeletionReleaseReviewArtifact({
      executionPlanEvidenceBundle: evidenceBundle,
      generatedAt: EVIDENCE_TIME,
      now: EVIDENCE_TIME,
    });

    expect(artifact.statusId)
      .toBe(POLICY_COMPATIBILITY_DELETION_RELEASE_REVIEW_ARTIFACT_STATUS_IDS.BLOCKED);
    expect(artifact.reviewRequired).toBe(false);
    expect(artifact.sourceRisks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          POLICY_COMPATIBILITY_DELETION_RELEASE_REVIEW_ARTIFACT_RISK_IDS
            .RELEASE_CONTEXT_FINGERPRINT_MISMATCH,
      }),
    ]));
    expect(artifact.validation.ok).toBe(true);
  });

  test('detects later approval-field injection and artifact fingerprint tampering', () => {
    const artifact = buildPolicyCompatibilityDeletionReleaseReviewArtifact({
      executionPlanEvidenceBundle: readyEvidenceBundle(),
      generatedAt: EVIDENCE_TIME,
      now: EVIDENCE_TIME,
    });
    const injected = {
      ...artifact,
      approvedBy: 'operator:release',
      artifactFingerprint: {
        ...artifact.artifactFingerprint,
        provenance: {
          ...artifact.artifactFingerprint.provenance,
          sourceStatusId: 'ready_for_deletion',
        },
      },
    };

    const validation = validatePolicyCompatibilityDeletionReleaseReviewArtifact(injected);

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          POLICY_COMPATIBILITY_DELETION_RELEASE_REVIEW_ARTIFACT_RISK_IDS
            .UNKNOWN_ARTIFACT_FIELD,
      }),
      expect.objectContaining({
        riskId:
          POLICY_COMPATIBILITY_DELETION_RELEASE_REVIEW_ARTIFACT_RISK_IDS
            .ARTIFACT_FINGERPRINT_INVALID,
      }),
    ]));
  });

  test('rejects side effects rather than treating the review request as execution', () => {
    const artifact = buildPolicyCompatibilityDeletionReleaseReviewArtifact({
      executionPlanEvidenceBundle: readyEvidenceBundle(),
      generatedAt: EVIDENCE_TIME,
      now: EVIDENCE_TIME,
      sideEffects: { storageChanged: true },
    });

    expect(artifact.validation.ok).toBe(false);
    expect(artifact.validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          POLICY_COMPATIBILITY_DELETION_RELEASE_REVIEW_ARTIFACT_RISK_IDS
            .SIDE_EFFECT_REPORTED,
      }),
    ]));
  });
});
