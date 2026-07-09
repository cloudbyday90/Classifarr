import {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_STATUS_IDS,
} from '../../services/policyCompatibilityDeletionExecutionPlan.mjs';
import {
  POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_STATUS_IDS,
} from '../../services/policyPostRemovalRuntimeVerification.mjs';
import {
  POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_ARTIFACT_RISK_IDS,
  POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_ARTIFACT_STATUS_IDS,
  buildPolicyNextCompatibilityRemovalBatchAuthorizationArtifact,
  validatePolicyNextCompatibilityRemovalBatchAuthorizationArtifact,
} from '../../services/policyNextCompatibilityRemovalBatchAuthorizationArtifact.mjs';

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

function input(overrides = {}) {
  return {
    requestedPaths: [MANIFEST_PATHS[1]],
    maxBatchSize: 2,
    authorizationReason: 'Continue removing verified compatibility preview paths.',
    authorizedBy: 'operator',
    ...overrides,
  };
}

describe('policyNextCompatibilityRemovalBatchAuthorizationArtifact', () => {
  test('wraps ready next-batch authorization evidence', () => {
    const artifact =
      buildPolicyNextCompatibilityRemovalBatchAuthorizationArtifact({
        postRemovalVerification: postRemovalVerification(),
        executionPlan: executionPlan(),
        input: input({
          requestedPaths: [MANIFEST_PATHS[1], MANIFEST_PATHS[2]],
        }),
        generatedAt: '2026-06-25T10:00:00.000Z',
      });

    expect(artifact.statusId)
      .toBe(POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_ARTIFACT_STATUS_IDS
        .READY_FOR_NEXT_BATCH);
    expect(artifact.readyForNextBatch).toBe(true);
    expect(artifact.completedNoRemainingPaths).toBe(false);
    expect(artifact.validation.ok).toBe(true);
    expect(artifact.authorization.readyForNextBatch).toBe(true);
    expect(artifact.authorizationSummary).toEqual({
      remainingCount: 2,
      removedCount: 1,
      requestedCount: 2,
      authorizedCount: 2,
      maxBatchSize: 2,
    });
    expect(artifact.nextPhase).toBeUndefined();
    expect(artifact.nextStep).toEqual(expect.objectContaining({
      stepId: 'compatibility_removal_completion_audit',
      label: 'Compatibility Removal Completion Audit',
    }));
  });

  test('wraps complete-no-remaining authorization evidence', () => {
    const artifact =
      buildPolicyNextCompatibilityRemovalBatchAuthorizationArtifact({
        postRemovalVerification: postRemovalVerification({
          applyEvidence: {
            appliedPathCount: MANIFEST_PATHS.length,
            appliedPaths: MANIFEST_PATHS,
          },
        }),
        executionPlan: executionPlan(),
        input: input({
          requestedPaths: [],
          authorizationReason: '',
          authorizedBy: '',
        }),
      });

    expect(artifact.statusId)
      .toBe(POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_ARTIFACT_STATUS_IDS
        .COMPLETE_NO_REMAINING_PATHS);
    expect(artifact.readyForNextBatch).toBe(false);
    expect(artifact.completedNoRemainingPaths).toBe(true);
    expect(artifact.authorization.completedNoRemainingPaths).toBe(true);
    expect(artifact.authorizationSummary.remainingCount).toBe(0);
  });

  test('blocks invalid requested paths', () => {
    const artifact =
      buildPolicyNextCompatibilityRemovalBatchAuthorizationArtifact({
        postRemovalVerification: postRemovalVerification(),
        executionPlan: executionPlan(),
        input: input({
          requestedPaths: ['server/src/services/notInManifest.mjs'],
        }),
      });

    expect(artifact.statusId)
      .toBe(POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_ARTIFACT_STATUS_IDS
        .BLOCKED);
    expect(artifact.readyForNextBatch).toBe(false);
    expect(artifact.validation.ok).toBe(true);
    expect(artifact.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_ARTIFACT_RISK_IDS
            .AUTHORIZATION_NOT_READY,
      }),
    ]));
    expect(artifact.authorization.statusId).toBe('blocked_by_selection');
  });

  test('rejects side effects in artifact output', () => {
    const artifact =
      buildPolicyNextCompatibilityRemovalBatchAuthorizationArtifact({
        postRemovalVerification: postRemovalVerification(),
        executionPlan: executionPlan(),
        input: input(),
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
      expect.objectContaining({
        riskId:
          POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_ARTIFACT_RISK_IDS
            .SIDE_EFFECT_REPORTED,
        sideEffect: 'manifestWritten',
      }),
      expect.objectContaining({
        riskId:
          POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_ARTIFACT_RISK_IDS
            .SIDE_EFFECT_REPORTED,
        sideEffect: 'gitCommandsRun',
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
