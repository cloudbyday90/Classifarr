import {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_VERSION,
  POLICY_COMPATIBILITY_DELETION_EXECUTION_STATUS_IDS,
} from '../../services/policyCompatibilityDeletionExecutionPlan.mjs';
import {
  POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_STATUS_IDS,
} from '../../services/policyNextCompatibilityRemovalBatchAuthorization.mjs';
import {
  POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_STATUS_IDS,
} from '../../services/policyPostRemovalRuntimeVerification.mjs';
import {
  POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_RISK_IDS,
  POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_STATUS_IDS,
  buildPolicyCompatibilityRemovalCompletionAuditArtifact,
  validatePolicyCompatibilityRemovalCompletionAuditArtifact,
} from '../../services/policyCompatibilityRemovalCompletionAuditArtifact.mjs';

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
    manifest: {
      approved: true,
      entryCount: entries.length,
      entries,
    },
    ...overrides,
  };
}

function completionAuthorization(overrides = {}) {
  return {
    statusId:
      POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_STATUS_IDS
        .COMPLETE_NO_REMAINING_PATHS,
    completedNoRemainingPaths: true,
    validation: {
      ok: true,
      issueCount: 0,
      issues: [],
    },
    remainingManifest: {
      totalCount: MANIFEST_PATHS.length,
      removedCount: MANIFEST_PATHS.length,
      remainingCount: 0,
      removedPaths: MANIFEST_PATHS,
      remainingPaths: [],
    },
    ...overrides,
  };
}

function removalVerification(paths = MANIFEST_PATHS, overrides = {}) {
  return {
    statusId: POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_STATUS_IDS.VERIFIED,
    verified: true,
    validation: {
      ok: true,
      issueCount: 0,
      issues: [],
    },
    applyEvidence: {
      appliedPathCount: paths.length,
      appliedPaths: paths,
    },
    ...overrides,
  };
}

function input(overrides = {}) {
  return {
    removalVerifications: [removalVerification()],
    finalImportScan: {
      completed: true,
      checkedPaths: MANIFEST_PATHS,
      references: [],
    },
    validationEvidence: {
      focused: {
        command: 'focused phase8r checks',
        passed: true,
      },
      full: {
        command: 'npm --prefix server test',
        passed: true,
      },
    },
    ...overrides,
  };
}

describe('policyCompatibilityRemovalCompletionAuditArtifact', () => {
  test('wraps a complete compatibility-removal completion audit', () => {
    const artifact =
      buildPolicyCompatibilityRemovalCompletionAuditArtifact({
        completionAuthorization: completionAuthorization(),
        executionPlan: executionPlan(),
        input: input(),
        generatedAt: '2026-06-25T11:00:00.000Z',
      });

    expect(artifact.statusId)
      .toBe(POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_STATUS_IDS
        .COMPLETE);
    expect(artifact.complete).toBe(true);
    expect(artifact.remainingInventory).toBe(false);
    expect(artifact.validation.ok).toBe(true);
    expect(artifact.audit.complete).toBe(true);
    expect(artifact.auditSummary).toEqual({
      manifestTotalCount: 3,
      manifestRemovedCount: 3,
      manifestRemainingCount: 0,
      removalVerificationCount: 1,
      removalVerifiedCount: 1,
      finalScanReferenceCount: 0,
    });
    expect(artifact.nextPhase).toBeUndefined();
    expect(artifact.nextStep).toEqual(expect.objectContaining({
      stepId: 'policy_storage_completion_checkpoint',
      label: 'Policy Storage Completion Checkpoint',
    }));
  });

  test('wraps remaining-inventory audit output without treating it as corruption', () => {
    const artifact =
      buildPolicyCompatibilityRemovalCompletionAuditArtifact({
        completionAuthorization: completionAuthorization({
          statusId:
            POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_STATUS_IDS
              .READY_FOR_NEXT_BATCH,
          completedNoRemainingPaths: false,
          remainingManifest: {
            totalCount: MANIFEST_PATHS.length,
            removedCount: 1,
            remainingCount: 2,
            removedPaths: [MANIFEST_PATHS[0]],
            remainingPaths: [MANIFEST_PATHS[1], MANIFEST_PATHS[2]],
          },
        }),
        executionPlan: executionPlan(),
        input: input({
          removalVerifications: [removalVerification([MANIFEST_PATHS[0]])],
        }),
      });

    expect(artifact.statusId)
      .toBe(POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_STATUS_IDS
        .REMAINING_INVENTORY);
    expect(artifact.complete).toBe(false);
    expect(artifact.remainingInventory).toBe(true);
    expect(artifact.validation.ok).toBe(true);
    expect(artifact.audit.manifestInventory.remainingPaths)
      .toEqual([MANIFEST_PATHS[1], MANIFEST_PATHS[2]]);
  });

  test('blocks when the final import scan still contains references', () => {
    const artifact =
      buildPolicyCompatibilityRemovalCompletionAuditArtifact({
        completionAuthorization: completionAuthorization(),
        executionPlan: executionPlan(),
        input: input({
          finalImportScan: {
            completed: true,
            checkedPaths: MANIFEST_PATHS,
            references: [{
              path: MANIFEST_PATHS[0],
              referencedBy: 'server/src/routes/policiesRoutePolicyWrite.mjs',
            }],
          },
        }),
      });

    expect(artifact.statusId)
      .toBe(POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_STATUS_IDS
        .BLOCKED);
    expect(artifact.complete).toBe(false);
    expect(artifact.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_RISK_IDS
            .AUDIT_BLOCKED,
      }),
    ]));
    expect(artifact.audit.statusId).toBe('blocked_by_final_scan');
  });

  test('rejects side effects in artifact output', () => {
    const artifact =
      buildPolicyCompatibilityRemovalCompletionAuditArtifact({
        completionAuthorization: completionAuthorization(),
        executionPlan: executionPlan(),
        input: input(),
        sideEffects: {
          filesDeleted: true,
          manifestWritten: true,
          gitCommandsRun: true,
        },
      });

    expect(artifact.statusId)
      .toBe(POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_STATUS_IDS
        .BLOCKED);
    expect(artifact.validation.ok).toBe(false);
    expect(artifact.validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_RISK_IDS
            .SIDE_EFFECT_REPORTED,
        sideEffect: 'filesDeleted',
      }),
      expect.objectContaining({
        riskId:
          POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_RISK_IDS
            .SIDE_EFFECT_REPORTED,
        sideEffect: 'manifestWritten',
      }),
      expect.objectContaining({
        riskId:
          POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_RISK_IDS
            .SIDE_EFFECT_REPORTED,
        sideEffect: 'gitCommandsRun',
      }),
    ]));
  });

  test('validates status and risk-count invariants', () => {
    const validation =
      validatePolicyCompatibilityRemovalCompletionAuditArtifact({
        statusId: 'unexpected',
        riskCount: 1,
        risks: [],
        sideEffects: {},
      });

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_RISK_IDS
            .UNKNOWN_STATUS,
      }),
      expect.objectContaining({
        riskId:
          POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_RISK_IDS
            .RISK_COUNT_MISMATCH,
      }),
    ]));
  });
});
