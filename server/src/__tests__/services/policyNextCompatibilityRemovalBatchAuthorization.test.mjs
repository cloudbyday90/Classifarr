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
  POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_STATUS_IDS,
} from '../../services/policyControlledCompatibilityPathRemoval.mjs';
import {
  buildPolicyPostRemovalRuntimeEvidenceArtifact,
} from '../../services/policyPostRemovalRuntimeEvidenceArtifact.mjs';
import {
  buildPolicyStorageClosurePathStateEvidence,
} from '../../services/policyStorageClosurePathStateEvidence.mjs';
import {
  POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS,
  POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_STATUS_IDS,
  buildPolicyNextCompatibilityRemovalBatchAuthorization,
  validatePolicyNextCompatibilityRemovalBatchAuthorization,
} from '../../services/policyNextCompatibilityRemovalBatchAuthorization.mjs';
import {
  buildReadyExecutionPlanArtifact,
} from './fixtures/policyCompatibilityDeletionExecutionGateFixtures.mjs';

const REVIEW_ARTIFACT_FINGERPRINT = 'a'.repeat(64);
const MANIFEST_PATHS = Object.freeze([
  'client/src/components/policies/PolicyStarterTemplateAccelerator.vue',
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
    version: POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_VERSION,
    statusId:
      POLICY_COMPATIBILITY_DELETION_EXECUTION_STATUS_IDS.READY_FOR_EXECUTION_GATE,
    readyForExecutionGate: true,
    validation: {
      ok: true,
      issueCount: 0,
      issues: [],
    },
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

function executionPlanArtifact(plan = executionPlan()) {
  return buildReadyExecutionPlanArtifact({ executionPlan: plan });
}

function pathStateEvidence({
  planArtifact,
  existingPaths = [],
} = {}) {
  const existingPathSet = new Set(existingPaths);

  return buildPolicyStorageClosurePathStateEvidence({
    executionPlanArtifact: planArtifact,
    observations: MANIFEST_PATHS.map(path => ({
      path,
      exists: existingPathSet.has(path),
    })),
    generatedAt: '2026-07-15T12:00:00.000Z',
    sideEffects: { filesRead: true },
  });
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

function partialRuntimeEvidenceArtifact() {
  const appliedPath = MANIFEST_PATHS[0];

  return buildPolicyPostRemovalRuntimeEvidenceArtifact({
    applyEvidence: {
      statusId: POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS
        .BLOCKED_BY_ADAPTER,
      applied: false,
      validation: { ok: true, issueCount: 0, issues: [] },
      removalReview: {
        statusId: POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_STATUS_IDS
          .READY_FOR_REMOVAL_REVIEW,
        validationOk: true,
        readyForRemovalReview: true,
        selectedCount: MANIFEST_PATHS.length,
        reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
        executionPlanArtifactFingerprint: 'b'.repeat(64),
        executionGateArtifactFingerprint: 'c'.repeat(64),
      },
      applyBatch: {
        requestedCount: MANIFEST_PATHS.length,
        checkedCount: 2,
        blockedEntry: {
          path: MANIFEST_PATHS[1],
          actionId: 'delete_file',
        },
        haltReasonId: 'adapter_failure',
        appliedCount: 1,
        entries: MANIFEST_PATHS.map(path => ({ path, actionId: 'delete_file' })),
        results: [{
          path: appliedPath,
          actionId: 'delete_file',
          applied: true,
        }],
      },
    },
    importScan: {
      completed: true,
      reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
      checkedPaths: [appliedPath],
      references: [],
    },
    runtimeChecks: [{
      checkId: 'partial-prefix-runtime-check',
      passed: true,
      checkedPaths: [appliedPath],
      reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
    }],
    validationEvidence: {
      focused: {
        command: 'focused partial validation',
        passed: true,
        checkedPaths: [appliedPath],
        reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
      },
      full: {
        command: 'full partial validation',
        passed: true,
        checkedPaths: [appliedPath],
        reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
      },
    },
  });
}

async function readyAuthorization(overrides = {}) {
  const plan = overrides.executionPlan || executionPlan();
  const planArtifact = overrides.executionPlanArtifact || executionPlanArtifact(plan);
  const runtimeArtifact = overrides.runtimeEvidenceArtifact || runtimeEvidenceArtifact();
  const appliedPaths = runtimeArtifact.provenance?.appliedPaths || [];
  const snapshot = overrides.pathStateEvidence || pathStateEvidence({
    planArtifact,
    existingPaths: MANIFEST_PATHS.filter(path => !appliedPaths.includes(path)),
  });

  return buildPolicyNextCompatibilityRemovalBatchAuthorization({
    runtimeEvidenceArtifact: runtimeArtifact,
    executionPlanArtifact: planArtifact,
    pathStateEvidence: snapshot,
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

  test('never authorizes another batch from a verified partial apply prefix', async () => {
    const authorization = await readyAuthorization({
      runtimeEvidenceArtifact: partialRuntimeEvidenceArtifact(),
    });

    expect(authorization.statusId)
      .toBe(POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_STATUS_IDS
        .BLOCKED_BY_POST_REMOVAL_VERIFICATION);
    expect(authorization.readyForNextBatch).toBe(false);
    expect(authorization.authorizedBatch.authorizedCount).toBe(0);
    expect(authorization.risks.map(risk => risk.riskId)).toContain(
      POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS
        .POST_REMOVAL_NOT_VERIFIED
    );
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
        .EXECUTION_PLAN_ARTIFACT_INVALID,
    ]));
    expect(notReady.risks.map(risk => risk.riskId)).toEqual(expect.arrayContaining([
      POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS
        .PATH_STATE_EVIDENCE_INVALID,
    ]));
    expect(noManifest.statusId)
      .toBe(POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_STATUS_IDS
        .BLOCKED_BY_EXECUTION_PLAN);
    expect(noManifest.risks.map(risk => risk.riskId)).toContain(
      POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS.NO_MANIFEST_ENTRIES
    );
  });

  test('requires an approved execution-plan artifact and a snapshot bound to it', async () => {
    const plan = executionPlan();
    const planArtifact = executionPlanArtifact(plan);
    const alternatePlanArtifact = buildReadyExecutionPlanArtifact({
      executionPlan: plan,
      generatedAt: '2026-07-14T20:00:01.000Z',
    });
    const rawPlan = await buildPolicyNextCompatibilityRemovalBatchAuthorization({
      runtimeEvidenceArtifact: runtimeEvidenceArtifact(),
      executionPlan: plan,
      requestedPaths: [MANIFEST_PATHS[1]],
      authorizationReason: 'Raw plans must not authorize compatibility removal.',
      authorizedBy: 'operator',
      reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
    });
    const crossArtifact = await readyAuthorization({
      executionPlanArtifact: planArtifact,
      pathStateEvidence: pathStateEvidence({
        planArtifact: alternatePlanArtifact,
        existingPaths: [MANIFEST_PATHS[1], MANIFEST_PATHS[2]],
      }),
    });

    expect(rawPlan.statusId)
      .toBe(POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_STATUS_IDS
        .BLOCKED_BY_EXECUTION_PLAN);
    expect(rawPlan.risks.map(risk => risk.riskId)).toEqual(expect.arrayContaining([
      POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS
        .EXECUTION_PLAN_ARTIFACT_INVALID,
      POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS
        .PATH_STATE_EVIDENCE_INVALID,
    ]));
    expect(crossArtifact.statusId)
      .toBe(POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_STATUS_IDS
        .BLOCKED_BY_PATH_STATE_EVIDENCE);
    expect(crossArtifact.risks.map(risk => risk.riskId)).toContain(
      POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS
        .PATH_STATE_EVIDENCE_ARTIFACT_MISMATCH
    );
  });

  test('requires runtime removal evidence to match the verified snapshot exactly', async () => {
    const planArtifact = executionPlanArtifact();
    const authorization = await readyAuthorization({
      executionPlanArtifact: planArtifact,
      pathStateEvidence: pathStateEvidence({
        planArtifact,
        existingPaths: MANIFEST_PATHS,
      }),
    });

    expect(authorization.statusId)
      .toBe(POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_STATUS_IDS
        .BLOCKED_BY_PATH_STATE_EVIDENCE);
    expect(authorization.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS
          .RUNTIME_APPLIED_PATH_STATE_MISMATCH,
        expectedRemovedPaths: [],
        actualAppliedPaths: [MANIFEST_PATHS[0]],
      }),
    ]));
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
