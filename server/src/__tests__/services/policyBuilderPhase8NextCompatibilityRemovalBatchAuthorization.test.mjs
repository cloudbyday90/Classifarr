import {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_STATUS_IDS,
} from '../../services/policyCompatibilityDeletionExecutionPlan.mjs';
import {
  POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_STATUS_IDS,
} from '../../services/policyPostRemovalRuntimeVerification.mjs';
import {
  PHASE8R_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS,
  PHASE8R_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_STATUS_IDS,
  buildPolicyBuilderPhase8NextCompatibilityRemovalBatchAuthorization,
  validatePolicyBuilderPhase8NextCompatibilityRemovalBatchAuthorization,
} from '../../services/policyBuilderPhase8NextCompatibilityRemovalBatchAuthorization.mjs';

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

function postRemovalVerification(overrides = {}) {
  return {
    statusId: POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_STATUS_IDS.VERIFIED,
    verified: true,
    validation: {
      ok: true,
      issueCount: 0,
      issues: [],
    },
    applyEvidence: {
      appliedPathCount: 1,
      appliedPaths: [MANIFEST_PATHS[0]],
    },
    ...overrides,
  };
}

function readyAuthorization(overrides = {}) {
  return buildPolicyBuilderPhase8NextCompatibilityRemovalBatchAuthorization({
    postRemovalVerification: postRemovalVerification(),
    executionPlan: executionPlan(),
    requestedPaths: [MANIFEST_PATHS[1]],
    authorizationReason: 'Continue removing verified compatibility preview paths.',
    authorizedBy: 'operator',
    ...overrides,
  });
}

describe('policyBuilderPhase8NextCompatibilityRemovalBatchAuthorization', () => {
  test('authorizes a narrow next batch from remaining approved manifest paths', () => {
    const authorization = readyAuthorization({
      requestedPaths: [MANIFEST_PATHS[1], MANIFEST_PATHS[2]],
      maxBatchSize: 2,
    });

    expect(authorization.statusId)
      .toBe(PHASE8R_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_STATUS_IDS
        .READY_FOR_NEXT_BATCH);
    expect(authorization.readyForNextBatch).toBe(true);
    expect(authorization.validation.ok).toBe(true);
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
    expect(authorization.nextPhase).toEqual(expect.objectContaining({
      phaseId: '8r_21',
      label: 'Compatibility Removal Completion Audit',
    }));
  });

  test('blocks when post-removal verification is not verified or is invalid', () => {
    const authorization = readyAuthorization({
      postRemovalVerification: postRemovalVerification({
        statusId: POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_STATUS_IDS
          .BLOCKED_BY_RUNTIME_CHECKS,
        verified: false,
        validation: {
          ok: false,
          issueCount: 1,
          issues: [],
        },
      }),
    });

    expect(authorization.statusId)
      .toBe(PHASE8R_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_STATUS_IDS
        .BLOCKED_BY_POST_REMOVAL_VERIFICATION);
    expect(authorization.readyForNextBatch).toBe(false);
    expect(authorization.risks.map(risk => risk.riskId)).toEqual(expect.arrayContaining([
      PHASE8R_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS
        .POST_REMOVAL_NOT_VERIFIED,
      PHASE8R_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS
        .POST_REMOVAL_VALIDATION_FAILED,
    ]));
  });

  test('blocks when the execution plan is not ready or has no manifest entries', () => {
    const notReady = readyAuthorization({
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
    const noManifest = readyAuthorization({
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
      .toBe(PHASE8R_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_STATUS_IDS
        .BLOCKED_BY_EXECUTION_PLAN);
    expect(notReady.risks.map(risk => risk.riskId)).toEqual(expect.arrayContaining([
      PHASE8R_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS
        .EXECUTION_PLAN_NOT_READY,
      PHASE8R_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS
        .EXECUTION_PLAN_VALIDATION_FAILED,
    ]));
    expect(noManifest.statusId)
      .toBe(PHASE8R_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_STATUS_IDS
        .BLOCKED_BY_EXECUTION_PLAN);
    expect(noManifest.risks.map(risk => risk.riskId)).toContain(
      PHASE8R_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS.NO_MANIFEST_ENTRIES
    );
  });

  test('blocks unknown paths or paths that were already removed', () => {
    const unknownPath = readyAuthorization({
      requestedPaths: ['server/src/services/notInManifest.mjs'],
    });
    const removedPath = readyAuthorization({
      requestedPaths: [MANIFEST_PATHS[0]],
    });

    expect(unknownPath.statusId)
      .toBe(PHASE8R_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_STATUS_IDS
        .BLOCKED_BY_SELECTION);
    expect(unknownPath.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          PHASE8R_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS
            .REQUESTED_PATH_NOT_IN_MANIFEST,
        path: 'server/src/services/notInManifest.mjs',
      }),
    ]));
    expect(removedPath.statusId)
      .toBe(PHASE8R_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_STATUS_IDS
        .BLOCKED_BY_SELECTION);
    expect(removedPath.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          PHASE8R_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS
            .REQUESTED_PATH_ALREADY_REMOVED,
        path: MANIFEST_PATHS[0],
      }),
    ]));
  });

  test('blocks empty or overly broad requested batches', () => {
    const emptyBatch = readyAuthorization({
      requestedPaths: [],
    });
    const broadBatch = readyAuthorization({
      requestedPaths: [MANIFEST_PATHS[1], MANIFEST_PATHS[2]],
      maxBatchSize: 1,
    });

    expect(emptyBatch.statusId)
      .toBe(PHASE8R_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_STATUS_IDS
        .BLOCKED_BY_SELECTION);
    expect(emptyBatch.risks.map(risk => risk.riskId)).toContain(
      PHASE8R_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS.NO_PATHS_REQUESTED
    );
    expect(broadBatch.statusId)
      .toBe(PHASE8R_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_STATUS_IDS
        .BLOCKED_BY_SCOPE);
    expect(broadBatch.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          PHASE8R_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS
            .BATCH_SCOPE_TOO_BROAD,
        requestedCount: 2,
        maxBatchSize: 1,
      }),
    ]));
  });

  test('blocks missing authorization metadata when remaining paths exist', () => {
    const authorization = readyAuthorization({
      authorizationReason: '',
      authorizedBy: '',
    });

    expect(authorization.statusId)
      .toBe(PHASE8R_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_STATUS_IDS
        .BLOCKED_BY_AUTHORIZATION);
    expect(authorization.risks.map(risk => risk.riskId)).toEqual(expect.arrayContaining([
      PHASE8R_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS
        .MISSING_AUTHORIZATION_REASON,
      PHASE8R_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS.MISSING_AUTHORIZER,
    ]));
  });

  test('completes when all approved manifest paths were already removed', () => {
    const authorization = readyAuthorization({
      postRemovalVerification: postRemovalVerification({
        applyEvidence: {
          appliedPathCount: MANIFEST_PATHS.length,
          appliedPaths: MANIFEST_PATHS,
        },
      }),
      requestedPaths: [],
      authorizationReason: '',
      authorizedBy: '',
    });

    expect(authorization.statusId)
      .toBe(PHASE8R_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_STATUS_IDS
        .COMPLETE_NO_REMAINING_PATHS);
    expect(authorization.readyForNextBatch).toBe(false);
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
    const validation =
      validatePolicyBuilderPhase8NextCompatibilityRemovalBatchAuthorization({
        statusId:
          PHASE8R_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_STATUS_IDS
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
      PHASE8R_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS
        .RISK_COUNT_MISMATCH,
      PHASE8R_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS
        .SIDE_EFFECT_PERFORMED,
    ]));
  });
});
