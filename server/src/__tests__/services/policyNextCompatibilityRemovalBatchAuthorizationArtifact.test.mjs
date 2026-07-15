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
  POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_VERSION,
  POLICY_COMPATIBILITY_DELETION_EXECUTION_STATUS_IDS,
} from '../../services/policyCompatibilityDeletionExecutionPlan.mjs';
import {
  POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS,
} from '../../services/policyControlledCompatibilityPathRemovalApply.mjs';
import {
  buildPolicyPostRemovalRuntimeEvidenceArtifact,
} from '../../services/policyPostRemovalRuntimeEvidenceArtifact.mjs';
import {
  buildNextBatchAuthorizationPathStateSource,
} from './fixtures/policyNextCompatibilityRemovalBatchAuthorizationFixtures.mjs';
import {
  POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_ARTIFACT_RISK_IDS,
  POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_ARTIFACT_STATUS_IDS,
  buildPolicyNextCompatibilityRemovalBatchAuthorizationArtifact,
  validatePolicyNextCompatibilityRemovalBatchAuthorizationArtifact,
} from '../../services/policyNextCompatibilityRemovalBatchAuthorizationArtifact.mjs';

const REVIEW_ARTIFACT_FINGERPRINT = 'a'.repeat(64);
const MANIFEST_PATHS = Object.freeze([
  'client/src/components/policies/PolicyStarterTemplateMechanics.vue',
  'server/src/services/policyIntentImpactPreview.mjs',
  'server/src/services/policyIntentReplayPreview.mjs',
]);

function executionPlan(overrides = {}) {
  const entries = overrides.entries || MANIFEST_PATHS.map(path => ({
      categoryId: 'old_preview_replay_diagnostics',
      actionId: 'delete_file',
      path,
      replacementEvidence: {
        replacementPath: 'server/src/services/policyNativeIntentProjection.mjs',
      },
      ready: true,
  }));

  return {
    version: POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_VERSION,
    statusId:
      POLICY_COMPATIBILITY_DELETION_EXECUTION_STATUS_IDS.READY_FOR_EXECUTION_GATE,
    readyForExecutionGate: true,
    validation: { ok: true, issueCount: 0, issues: [] },
    riskCount: 0,
    risks: [],
    sideEffects: {
      filesDeleted: false,
      filesArchived: false,
      storageChanged: false,
      gitCommandsRun: false,
    },
    manifest: {
      approved: true,
      approvedBy: 'operator',
      entryCount: entries.length,
      entries,
    },
    ...overrides,
  };
}

function runtimeEvidenceArtifact(appliedPaths = [MANIFEST_PATHS[0]]) {
  return buildPolicyPostRemovalRuntimeEvidenceArtifact({
    applyEvidence: {
      statusId: POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS.APPLIED,
      applied: true,
      validation: { ok: true, issueCount: 0, issues: [] },
      removalReview: {
        reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
      },
      applyBatch: {
        requestedCount: appliedPaths.length,
        results: appliedPaths.map(path => ({
          path,
          actionId: 'delete_file',
          applied: true,
        })),
      },
    },
    importScan: {
      completed: true,
      reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
      checkedPaths: appliedPaths,
      references: [],
    },
    runtimeChecks: [{
      checkId: 'policy-runtime-imports',
      passed: true,
      reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
    }],
    validationEvidence: {
      focused: {
        command: 'focused validation',
        passed: true,
        reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
      },
      full: {
        command: 'full validation',
        passed: true,
        reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
      },
    },
  });
}

function input(overrides = {}) {
  return {
    requestedPaths: [MANIFEST_PATHS[1]],
    maxBatchSize: 2,
    authorizationReason: 'Continue removing verified compatibility preview paths.',
    authorizedBy: 'operator',
    reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
    ...overrides,
  };
}

async function authorizationArtifact({
  plan = executionPlan(),
  runtimeArtifact = runtimeEvidenceArtifact(),
  authorizationInput = input(),
  ...overrides
} = {}) {
  const appliedPaths = runtimeArtifact.provenance?.appliedPaths || [];
  const source = buildNextBatchAuthorizationPathStateSource({
    executionPlan: plan,
    existingPaths: MANIFEST_PATHS.filter(path => !appliedPaths.includes(path)),
  });

  return buildPolicyNextCompatibilityRemovalBatchAuthorizationArtifact({
    runtimeEvidenceArtifact: runtimeArtifact,
    ...source,
    input: authorizationInput,
    ...overrides,
  });
}

describe('policyNextCompatibilityRemovalBatchAuthorizationArtifact', () => {
  test('wraps ready next-batch authorization with its runtime evidence artifact', async () => {
    const evidenceArtifact = runtimeEvidenceArtifact();
    const artifact =
      await authorizationArtifact({
        runtimeArtifact: evidenceArtifact,
        authorizationInput: input({
          requestedPaths: [MANIFEST_PATHS[1], MANIFEST_PATHS[2]],
        }),
        generatedAt: '2026-06-25T10:00:00.000Z',
      });

    expect(artifact.statusId)
      .toBe(POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_ARTIFACT_STATUS_IDS
        .READY_FOR_NEXT_BATCH);
    expect(artifact.readyForNextBatch).toBe(true);
    expect(artifact.validation.ok).toBe(true);
    expect(artifact.runtimeEvidenceArtifact).toBe(evidenceArtifact);
    expect(artifact.authorizationSummary).toEqual({
      remainingCount: 2,
      removedCount: 1,
      requestedCount: 2,
      authorizedCount: 2,
      maxBatchSize: 2,
    });
  });

  test('wraps complete-no-remaining authorization with an intact full-manifest artifact', async () => {
    const artifact =
      await authorizationArtifact({
        runtimeArtifact: runtimeEvidenceArtifact(MANIFEST_PATHS),
        authorizationInput: input({
          requestedPaths: [],
          authorizationReason: '',
          authorizedBy: '',
        }),
      });

    expect(artifact.statusId)
      .toBe(POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_ARTIFACT_STATUS_IDS
        .COMPLETE_NO_REMAINING_PATHS);
    expect(artifact.completedNoRemainingPaths).toBe(true);
    expect(artifact.authorizationSummary.remainingCount).toBe(0);
  });

  test('blocks invalid requested paths and invalid runtime evidence', async () => {
    const evidenceArtifact = runtimeEvidenceArtifact();
    const invalidEvidenceArtifact = {
      ...evidenceArtifact,
      evidence: {
        ...evidenceArtifact.evidence,
        importScan: {
          ...evidenceArtifact.evidence.importScan,
          checkedPaths: [],
        },
      },
    };
    const invalidPath =
      await authorizationArtifact({
        runtimeArtifact: evidenceArtifact,
        authorizationInput: input({
          requestedPaths: ['server/src/services/notInManifest.mjs'],
        }),
      });
    const invalidEvidence =
      await authorizationArtifact({
        runtimeArtifact: invalidEvidenceArtifact,
        authorizationInput: input(),
      });

    [invalidPath, invalidEvidence].forEach(artifact => {
      expect(artifact.statusId)
        .toBe(POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_ARTIFACT_STATUS_IDS
          .BLOCKED);
      expect(artifact.risks).toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId:
            POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_ARTIFACT_RISK_IDS
              .AUTHORIZATION_NOT_READY,
        }),
      ]));
    });
    expect(invalidEvidence.authorization.statusId)
      .toBe('blocked_by_runtime_evidence_integrity');
  });

  test('rejects side effects in artifact output', async () => {
    const artifact =
      await authorizationArtifact({
        authorizationInput: input(),
        sideEffects: {
          filesDeleted: true,
          manifestWritten: true,
          gitCommandsRun: true,
        },
      });

    expect(artifact.statusId)
      .toBe(POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_ARTIFACT_STATUS_IDS
        .BLOCKED);
    expect(artifact.validation.ok).toBe(false);
    expect(artifact.validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_ARTIFACT_RISK_IDS
            .SIDE_EFFECT_REPORTED,
        sideEffect: 'filesDeleted',
      }),
    ]));
  });

  test('validates status and risk-count invariants', () => {
    const validation =
      validatePolicyNextCompatibilityRemovalBatchAuthorizationArtifact({
        statusId: 'unexpected',
        riskCount: 1,
        risks: [],
        sideEffects: {},
      });

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_ARTIFACT_RISK_IDS
            .UNKNOWN_STATUS,
      }),
      expect.objectContaining({
        riskId:
          POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_ARTIFACT_RISK_IDS
            .RISK_COUNT_MISMATCH,
      }),
    ]));
  });
});
