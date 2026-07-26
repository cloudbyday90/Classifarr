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
  POLICY_COMPATIBILITY_REMOVAL_RUNTIME_EVIDENCE_CUTOVER_REASON_IDS,
  POLICY_COMPATIBILITY_REMOVAL_RUNTIME_EVIDENCE_CUTOVER_STATUS_IDS,
  evaluatePolicyCompatibilityRemovalRuntimeEvidenceCutover,
} from '../../services/policyCompatibilityRemovalRuntimeEvidenceCutover.mjs';
import {
  buildPolicyPostRemovalRuntimeEvidenceArtifact,
} from '../../services/policyPostRemovalRuntimeEvidenceArtifact.mjs';

const REVIEW_ARTIFACT_FINGERPRINT = 'a'.repeat(64);
const EXECUTION_PLAN_ARTIFACT_FINGERPRINT = 'b'.repeat(64);
const OTHER_EXECUTION_PLAN_ARTIFACT_FINGERPRINT = 'c'.repeat(64);

function buildRuntimeEvidenceArtifact(
  executionPlanArtifactFingerprint = EXECUTION_PLAN_ARTIFACT_FINGERPRINT
) {
  return buildPolicyPostRemovalRuntimeEvidenceArtifact({
    applyEvidence: {
      removalReview: {
        reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
        executionPlanArtifactFingerprint,
      },
      applyBatch: {
        results: [{
          path: 'server/src/services/retiredCompatibilityService.mjs',
          applied: true,
        }],
      },
    },
    importScan: {
      reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
    },
    runtimeChecks: [{
      reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
      passed: true,
    }],
    validationEvidence: {
      focused: {
        reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
        passed: true,
      },
      full: {
        reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
        passed: true,
      },
    },
  });
}

describe('policyCompatibilityRemovalRuntimeEvidenceCutover', () => {
  test('accepts only the current runtime-evidence contract bound to the current plan', () => {
    const evaluation = evaluatePolicyCompatibilityRemovalRuntimeEvidenceCutover({
      runtimeEvidenceArtifact: buildRuntimeEvidenceArtifact(),
      expectedExecutionPlanArtifactFingerprint:
        EXECUTION_PLAN_ARTIFACT_FINGERPRINT,
    });

    expect(evaluation).toEqual(expect.objectContaining({
      statusId:
        POLICY_COMPATIBILITY_REMOVAL_RUNTIME_EVIDENCE_CUTOVER_STATUS_IDS.READY,
      ready: true,
      reasonIds: [],
    }));
  });

  test('rejects a pre-v2 runtime-evidence artifact with a fixed reason ID', () => {
    const artifact = buildRuntimeEvidenceArtifact();
    artifact.version = 'policy.post_removal_runtime_evidence_artifact.v1';

    const evaluation = evaluatePolicyCompatibilityRemovalRuntimeEvidenceCutover({
      runtimeEvidenceArtifact: artifact,
      expectedExecutionPlanArtifactFingerprint:
        EXECUTION_PLAN_ARTIFACT_FINGERPRINT,
    });

    expect(evaluation.reasonIds).toEqual([
      POLICY_COMPATIBILITY_REMOVAL_RUNTIME_EVIDENCE_CUTOVER_REASON_IDS
        .RUNTIME_EVIDENCE_CONTRACT_UNSUPPORTED,
    ]);
  });

  test('rejects missing and cross-plan execution-plan bindings', () => {
    const missingBinding = buildRuntimeEvidenceArtifact('');
    const missingEvaluation = evaluatePolicyCompatibilityRemovalRuntimeEvidenceCutover({
      runtimeEvidenceArtifact: missingBinding,
      expectedExecutionPlanArtifactFingerprint:
        EXECUTION_PLAN_ARTIFACT_FINGERPRINT,
    });
    const crossPlanEvaluation = evaluatePolicyCompatibilityRemovalRuntimeEvidenceCutover({
      runtimeEvidenceArtifact: buildRuntimeEvidenceArtifact(
        OTHER_EXECUTION_PLAN_ARTIFACT_FINGERPRINT
      ),
      expectedExecutionPlanArtifactFingerprint:
        EXECUTION_PLAN_ARTIFACT_FINGERPRINT,
    });

    expect(missingEvaluation.reasonIds).toContain(
      POLICY_COMPATIBILITY_REMOVAL_RUNTIME_EVIDENCE_CUTOVER_REASON_IDS
        .EXECUTION_PLAN_FINGERPRINT_MISSING
    );
    expect(crossPlanEvaluation.reasonIds).toContain(
      POLICY_COMPATIBILITY_REMOVAL_RUNTIME_EVIDENCE_CUTOVER_REASON_IDS
        .EXECUTION_PLAN_FINGERPRINT_MISMATCH
    );
    expect(crossPlanEvaluation.nextStep).toEqual(expect.objectContaining({
      stepId: 'regenerate_current_runtime_evidence',
    }));
  });

  test('rejects an invalid supplied execution-plan fingerprint', () => {
    const evaluation = evaluatePolicyCompatibilityRemovalRuntimeEvidenceCutover({
      runtimeEvidenceArtifact: buildRuntimeEvidenceArtifact(),
      expectedExecutionPlanArtifactFingerprint: 'not-a-sha256-fingerprint',
    });

    expect(evaluation).toEqual(expect.objectContaining({
      ready: false,
      statusId:
        POLICY_COMPATIBILITY_REMOVAL_RUNTIME_EVIDENCE_CUTOVER_STATUS_IDS.BLOCKED,
    }));
    expect(evaluation.reasonIds).toContain(
      POLICY_COMPATIBILITY_REMOVAL_RUNTIME_EVIDENCE_CUTOVER_REASON_IDS
        .EXECUTION_PLAN_FINGERPRINT_INVALID
    );
  });
});
