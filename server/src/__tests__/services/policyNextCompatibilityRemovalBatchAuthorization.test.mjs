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
  POLICY_COMPATIBILITY_DELETION_EXECUTION_STATUS_IDS,
} from '../../services/policyCompatibilityDeletionExecutionPlan.mjs';
import {
  POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS,
} from '../../services/policyControlledCompatibilityPathRemovalApply.mjs';
import {
  buildPolicyPostRemovalRuntimeEvidenceArtifact,
} from '../../services/policyPostRemovalRuntimeEvidenceArtifact.mjs';
import {
  POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS,
  POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_STATUS_IDS,
  buildPolicyNextCompatibilityRemovalBatchAuthorization,
  validatePolicyNextCompatibilityRemovalBatchAuthorization,
} from '../../services/policyNextCompatibilityRemovalBatchAuthorization.mjs';

const REVIEW_ARTIFACT_FINGERPRINT = 'a'.repeat(64);
const MANIFEST_PATHS = Object.freeze([
  'client/src/components/policies/PolicyStarterTemplateMechanics.vue',
  'server/src/services/policyIntentImpactPreview.mjs',
  'server/src/services/policyIntentReplayPreview.mjs',
]);

function manifestEntry(path, overrides = {}) {
  return {
    categoryId: 'old_preview_replay_diagnostics',
    actionId: 'delete_file',
    path,
    replacementEvidence: {
      replacementPath: 'server/src/services/policyNativeIntentProjection.mjs',
      validation: 'covered by native projection tests',
    },
    ready: true,
    ...overrides,
  };
}

function executionPlan(overrides = {}) {
  const entries = overrides.entries || MANIFEST_PATHS.map(path => manifestEntry(path));

  return {
    statusId:
      POLICY_COMPATIBILITY_DELETION_EXECUTION_STATUS_IDS.READY_FOR_EXECUTION_GATE,
    readyForExecutionGate: true,
    validation: {
      ok: true,
      issueCount: 0,
      issues: [],
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

function runtimeEvidenceArtifact({
  appliedPaths = [MANIFEST_PATHS[0]],
  reviewArtifactFingerprint = REVIEW_ARTIFACT_FINGERPRINT,
  ...overrides
} = {}) {
  return buildPolicyPostRemovalRuntimeEvidenceArtifact({
    applyEvidence: {
      statusId: POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS.APPLIED,
      applied: true,
      validation: {
        ok: true,
        issueCount: 0,
        issues: [],
      },
      removalReview: {
        reviewArtifactFingerprint,
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
      reviewArtifactFingerprint,
      checkedPaths: appliedPaths,
      references: [],
    },
    runtimeChecks: [{
      checkId: 'policy-runtime-imports',
      passed: true,
      reviewArtifactFingerprint,
    }],
    validationEvidence: {
      focused: {
        command: 'node scripts/run-jest.mjs --testPathPatterns="policy" --no-coverage',
        passed: true,
        reviewArtifactFingerprint,
      },
      full: {
        command: 'npm test',
        passed: true,
        reviewArtifactFingerprint,
      },
    },
    ...overrides,
  });
}

async function readyAuthorization(overrides = {}) {
  return buildPolicyNextCompatibilityRemovalBatchAuthorization({
    runtimeEvidenceArtifact: runtimeEvidenceArtifact(),
    executionPlan: executionPlan(),
    requestedPaths: [MANIFEST_PATHS[1]],
    authorizationReason: 'Continue removing verified compatibility preview paths.',
    authorizedBy: 'operator',
    reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
    ...overrides,
  });
}

describe('policyNextCompatibilityRemovalBatchAuthorization', () => {
  test('authorizes a narrow next batch from remaining approved manifest paths', async () => {
    const authorization = await readyAuthorization({
      requestedPaths: [MANIFEST_PATHS[1], MANIFEST_PATHS[2]],
      maxBatchSize: 2,
    });

    expect(authorization.statusId)
      .toBe(POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_STATUS_IDS
        .READY_FOR_NEXT_BATCH);
    expect(authorization.readyForNextBatch).toBe(true);
    expect(authorization.validation.ok).toBe(true);
    expect(authorization.runtimeEvidenceArtifact).toEqual(expect.objectContaining({
      valid: true,
      reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
    }));
    expect(authorization.authorizationContext).toEqual({
      reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
    });
    expect(authorization.remainingManifest).toEqual(expect.objectContaining({
      totalCount: 3,
      removedCount: 1,
      remainingCount: 2,
      removedPaths: [MANIFEST_PATHS[0]],
      remainingPaths: [MANIFEST_PATHS[1], MANIFEST_PATHS[2]],
    }));
    expect(authorization.authorizedBatch).toEqual(expect.objectContaining({
      requestedCount: 2,
      authorizedCount: 2,
      maxBatchSize: 2,
      authorizedBy: 'operator',
    }));
    expect(authorization.authorizedBatch.entries.map(entry => entry.path))
      .toEqual([MANIFEST_PATHS[1], MANIFEST_PATHS[2]]);
    expect(authorization.sideEffects).toEqual({
      filesDeleted: false,
      filesArchived: false,
      routesRemoved: false,
      testsRemoved: false,
      storageChanged: false,
      manifestWritten: false,
      gitCommandsRun: false,
    });
  });

  test('rejects missing, altered, or cross-context runtime evidence before authorizing a batch', async () => {
    const validArtifact = runtimeEvidenceArtifact();
    const alteredArtifact = {
      ...validArtifact,
      evidence: {
        ...validArtifact.evidence,
        importScan: {
          ...validArtifact.evidence.importScan,
          checkedPaths: [],
        },
      },
    };
    const missing = await readyAuthorization({ runtimeEvidenceArtifact: null });
    const altered = await readyAuthorization({ runtimeEvidenceArtifact: alteredArtifact });
    const missingContext = await readyAuthorization({
      reviewArtifactFingerprint: '',
    });
    const crossContext = await readyAuthorization({
      reviewArtifactFingerprint: 'b'.repeat(64),
    });

    [missing, altered, missingContext, crossContext].forEach(authorization => {
      expect(authorization.statusId)
        .toBe(POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_STATUS_IDS
          .BLOCKED_BY_RUNTIME_EVIDENCE_INTEGRITY);
      expect(authorization.readyForNextBatch).toBe(false);
    });
    expect(missing.risks.map(risk => risk.riskId)).toContain(
      POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS
        .RUNTIME_EVIDENCE_ARTIFACT_MISSING
    );
    expect(altered.risks.map(risk => risk.riskId)).toContain(
      POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS
        .RUNTIME_EVIDENCE_ARTIFACT_INVALID
    );
    expect(missingContext.risks.map(risk => risk.riskId)).toContain(
      POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS
        .REVIEW_ARTIFACT_FINGERPRINT_MISSING
    );
    expect(crossContext.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS
          .REVIEW_ARTIFACT_FINGERPRINT_MISMATCH,
      }),
    ]));
  });

  test('rejects runtime evidence whose applied paths are outside the current execution manifest', async () => {
    const authorization = await readyAuthorization({
      runtimeEvidenceArtifact: runtimeEvidenceArtifact({
        appliedPaths: [
          MANIFEST_PATHS[0],
          'server/src/services/unrelatedCompatibilityPath.mjs',
        ],
      }),
    });

    expect(authorization.statusId)
      .toBe(POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_STATUS_IDS
        .BLOCKED_BY_RUNTIME_EVIDENCE_INTEGRITY);
    expect(authorization.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS
          .APPLIED_PATH_OUTSIDE_EXECUTION_MANIFEST,
        path: 'server/src/services/unrelatedCompatibilityPath.mjs',
      }),
    ]));
  });

  test('blocks when post-removal verification fails after integrity succeeds', async () => {
    const artifact = runtimeEvidenceArtifact();
    const failingArtifact = buildPolicyPostRemovalRuntimeEvidenceArtifact({
      ...artifact.evidence,
      runtimeChecks: [{
        ...artifact.evidence.runtimeChecks[0],
        passed: false,
      }],
    });
    const authorization = await readyAuthorization({
      runtimeEvidenceArtifact: failingArtifact,
    });

    expect(authorization.statusId)
      .toBe(POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_STATUS_IDS
        .BLOCKED_BY_POST_REMOVAL_VERIFICATION);
    expect(authorization.risks.map(risk => risk.riskId)).toEqual(expect.arrayContaining([
      POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS
        .POST_REMOVAL_NOT_VERIFIED,
    ]));
  });

  test('blocks when the execution plan is not ready or has no manifest entries', async () => {
    const notReady = await readyAuthorization({
      executionPlan: executionPlan({
        statusId: POLICY_COMPATIBILITY_DELETION_EXECUTION_STATUS_IDS
          .BLOCKED_BY_APPROVAL,
        readyForExecutionGate: false,
        validation: {
          ok: false,
          issueCount: 1,
          issues: [],
        },
      }),
    });
    const noManifest = await readyAuthorization({
      executionPlan: executionPlan({
        entries: [],
        manifest: {
          approved: true,
          entryCount: 0,
          entries: [],
        },
      }),
    });

    expect(notReady.statusId)
      .toBe(POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_STATUS_IDS
        .BLOCKED_BY_EXECUTION_PLAN);
    expect(notReady.risks.map(risk => risk.riskId)).toEqual(expect.arrayContaining([
      POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS
        .EXECUTION_PLAN_NOT_READY,
      POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS
        .EXECUTION_PLAN_VALIDATION_FAILED,
    ]));
    expect(noManifest.statusId)
      .toBe(POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_STATUS_IDS
        .BLOCKED_BY_EXECUTION_PLAN);
    expect(noManifest.risks.map(risk => risk.riskId)).toContain(
      POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS.NO_MANIFEST_ENTRIES
    );
  });

  test('blocks unknown paths, removed paths, empty batches, and broad batches', async () => {
    const unknownPath = await readyAuthorization({
      requestedPaths: ['server/src/services/notInManifest.mjs'],
    });
    const removedPath = await readyAuthorization({
      requestedPaths: [MANIFEST_PATHS[0]],
    });
    const emptyBatch = await readyAuthorization({ requestedPaths: [] });
    const broadBatch = await readyAuthorization({
      requestedPaths: [MANIFEST_PATHS[1], MANIFEST_PATHS[2]],
      maxBatchSize: 1,
    });

    expect(unknownPath.statusId).toBe('blocked_by_selection');
    expect(removedPath.statusId).toBe('blocked_by_selection');
    expect(emptyBatch.statusId).toBe('blocked_by_selection');
    expect(broadBatch.statusId).toBe('blocked_by_scope');
  });

  test('blocks missing authorization metadata when remaining paths exist', async () => {
    const authorization = await readyAuthorization({
      authorizationReason: '',
      authorizedBy: '',
    });

    expect(authorization.statusId)
      .toBe(POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_STATUS_IDS
        .BLOCKED_BY_AUTHORIZATION);
    expect(authorization.risks.map(risk => risk.riskId)).toEqual(expect.arrayContaining([
      POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS
        .MISSING_AUTHORIZATION_REASON,
      POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS.MISSING_AUTHORIZER,
    ]));
  });

  test('completes when every approved manifest path is present in valid runtime evidence', async () => {
    const authorization = await readyAuthorization({
      runtimeEvidenceArtifact: runtimeEvidenceArtifact({
        appliedPaths: MANIFEST_PATHS,
      }),
      requestedPaths: [],
      authorizationReason: '',
      authorizedBy: '',
    });

    expect(authorization.statusId)
      .toBe(POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_STATUS_IDS
        .COMPLETE_NO_REMAINING_PATHS);
    expect(authorization.completedNoRemainingPaths).toBe(true);
    expect(authorization.remainingManifest).toEqual(expect.objectContaining({
      totalCount: 3,
      removedCount: 3,
      remainingCount: 0,
      remainingPaths: [],
    }));
    expect(authorization.risks).toEqual([]);
  });

  test('rejects mutated authorization output with stale risk counts or side effects', () => {
    const validation = validatePolicyNextCompatibilityRemovalBatchAuthorization({
      statusId:
        POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_STATUS_IDS
          .READY_FOR_NEXT_BATCH,
      riskCount: 99,
      risks: [],
      sideEffects: {
        filesDeleted: true,
        storageChanged: true,
        gitCommandsRun: true,
      },
    });

    expect(validation.ok).toBe(false);
    expect(validation.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS
        .RISK_COUNT_MISMATCH,
      POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS
        .SIDE_EFFECT_PERFORMED,
    ]));
  });
});
