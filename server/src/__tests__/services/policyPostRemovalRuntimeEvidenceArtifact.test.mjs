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
  POLICY_POST_REMOVAL_RUNTIME_EVIDENCE_ARTIFACT_RISK_IDS,
  POLICY_POST_REMOVAL_RUNTIME_EVIDENCE_ARTIFACT_VERSION,
  buildPolicyPostRemovalRuntimeEvidenceArtifact,
  validatePolicyPostRemovalRuntimeEvidenceArtifact,
} from '../../services/policyPostRemovalRuntimeEvidenceArtifact.mjs';

const REVIEW_ARTIFACT_FINGERPRINT = 'a'.repeat(64);
const EXECUTION_PLAN_ARTIFACT_FINGERPRINT = 'b'.repeat(64);

function applyEvidence(overrides = {}) {
  return {
    removalReview: {
      reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
      executionPlanArtifactFingerprint: EXECUTION_PLAN_ARTIFACT_FINGERPRINT,
    },
    applyBatch: {
      results: [{
        path: 'server/src/services/policyIntentMapper.mjs',
        actionId: 'delete_file',
        applied: true,
      }],
    },
    ...overrides,
  };
}

function importScan(overrides = {}) {
  return {
    completed: true,
    reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
    checkedPaths: ['server/src/services/policyIntentMapper.mjs'],
    references: [],
    ...overrides,
  };
}

function runtimeChecks(overrides = []) {
  return [{
    checkId: 'policy-runtime-imports',
    passed: true,
    reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
  }, ...overrides];
}

function validationEvidence(overrides = {}) {
  return {
    focused: {
      command: 'npm --prefix server test -- policyIntentMapper',
      passed: true,
      reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
      executionPlanArtifactFingerprint: EXECUTION_PLAN_ARTIFACT_FINGERPRINT,
    },
    full: {
      command: 'npm --prefix server test',
      passed: true,
      reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
    },
    ...overrides,
  };
}

function evidenceArtifact(overrides = {}) {
  return buildPolicyPostRemovalRuntimeEvidenceArtifact({
    applyEvidence: applyEvidence(),
    importScan: importScan(),
    runtimeChecks: runtimeChecks(),
    validationEvidence: validationEvidence(),
    ...overrides,
  });
}

describe('policyPostRemovalRuntimeEvidenceArtifact', () => {
  test('binds import, runtime, and validation evidence to the applied review artifact', () => {
    const artifact = evidenceArtifact();

    expect(artifact.version)
      .toBe(POLICY_POST_REMOVAL_RUNTIME_EVIDENCE_ARTIFACT_VERSION);
    expect(artifact.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(artifact.provenance).toEqual(expect.objectContaining({
      reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
      appliedPaths: ['server/src/services/policyIntentMapper.mjs'],
      runtimeCheckCount: 1,
    }));
    expect(validatePolicyPostRemovalRuntimeEvidenceArtifact(artifact)).toEqual(
      expect.objectContaining({ ok: true })
    );
  });

  test('rejects missing or cross-batch review bindings', () => {
    const artifact = evidenceArtifact({
      runtimeChecks: runtimeChecks([{
        checkId: 'policy-write-runtime',
        passed: true,
        reviewArtifactFingerprint: 'b'.repeat(64),
      }]),
      validationEvidence: validationEvidence({
        focused: {
          command: 'focused validation',
          passed: true,
        },
      }),
    });

    const validation = validatePolicyPostRemovalRuntimeEvidenceArtifact(artifact);

    expect(validation.ok).toBe(false);
    expect(validation.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      POLICY_POST_REMOVAL_RUNTIME_EVIDENCE_ARTIFACT_RISK_IDS
        .RUNTIME_CHECK_REVIEW_BINDING_MISMATCH,
      POLICY_POST_REMOVAL_RUNTIME_EVIDENCE_ARTIFACT_RISK_IDS
        .FOCUSED_VALIDATION_REVIEW_BINDING_MISSING,
    ]));
  });

  test('rejects runtime evidence without the execution-plan artifact binding', () => {
    const artifact = evidenceArtifact({
      applyEvidence: applyEvidence({
        removalReview: {
          reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
        },
      }),
    });

    const validation = validatePolicyPostRemovalRuntimeEvidenceArtifact(artifact);

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_POST_REMOVAL_RUNTIME_EVIDENCE_ARTIFACT_RISK_IDS
          .APPLIED_EXECUTION_PLAN_FINGERPRINT_MISSING,
      }),
    ]));
  });

  test('rejects evidence altered after its artifact is generated', () => {
    const artifact = evidenceArtifact();
    artifact.evidence.importScan.references.push({
      path: 'server/src/services/policyIntentMapper.mjs',
      referencedBy: 'server/src/routes/policiesRoutePolicyWrite.mjs',
    });

    const validation = validatePolicyPostRemovalRuntimeEvidenceArtifact(artifact);

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_POST_REMOVAL_RUNTIME_EVIDENCE_ARTIFACT_RISK_IDS
          .RUNTIME_EVIDENCE_ARTIFACT_MISMATCH,
      }),
    ]));
  });
});
