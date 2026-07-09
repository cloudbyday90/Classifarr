import {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_ACTION_IDS,
  POLICY_COMPATIBILITY_DELETION_EXECUTION_STATUS_IDS,
} from '../../services/policyCompatibilityDeletionExecutionPlan.mjs';
import {
  POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_STATUS_IDS,
} from '../../services/policyControlledCompatibilityPathRemoval.mjs';
import {
  PHASE8R_CONTROLLED_REMOVAL_BATCH_ARTIFACT_RISK_IDS,
  PHASE8R_CONTROLLED_REMOVAL_BATCH_ARTIFACT_STATUS_IDS,
  buildPolicyBuilderPhase8ControlledRemovalBatchArtifact,
  validatePolicyBuilderPhase8ControlledRemovalBatchArtifact,
} from '../../services/policyBuilderPhase8ControlledRemovalBatchArtifact.mjs';

const MANIFEST_PATH =
  'client/src/components/policies/PolicyStarterTemplateMechanics.vue';

function executionPlan(overrides = {}) {
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
      approvedBy: 'phase8r-maintainer',
      entryCount: 1,
      entries: [{
        categoryId: 'client_bridge_ui',
        actionId:
          POLICY_COMPATIBILITY_DELETION_EXECUTION_ACTION_IDS.DELETE_FILE,
        path: MANIFEST_PATH,
        deletionIntent: 'Remove bridge-only UI after native replacement.',
        replacementEvidence: {
          replacement:
            'Native policy builder destination context replaces this UI.',
          tests: ['PolicyBuilderLibraryContext.test.js'],
        },
        ready: true,
      }],
    },
    ...overrides,
  };
}

function readyInput(overrides = {}) {
  return {
    worktreeClean: true,
    backupRestoreVerified: true,
    backupRestoreFresh: true,
    operatorApproval: {
      approved: true,
      approvedBy: 'phase8r-maintainer',
    },
    rollbackStanceFinal: true,
    supportStanceFinal: true,
    manifestFresh: true,
    manifestMatchesCurrentPlan: true,
    selectedPaths: [MANIFEST_PATH],
    maxBatchSize: 1,
    removalReason:
      'First controlled batch removes one bridge-only UI file from the approved manifest.',
    reviewedBy: 'phase8r-maintainer',
    ...overrides,
  };
}

describe('policyBuilderPhase8ControlledRemovalBatchArtifact', () => {
  test('builds a ready controlled removal batch artifact', () => {
    const artifact = buildPolicyBuilderPhase8ControlledRemovalBatchArtifact({
      executionPlan: executionPlan(),
      input: readyInput(),
      generatedAt: '2026-07-01T00:00:00.000Z',
    });

    expect(artifact.statusId)
      .toBe(PHASE8R_CONTROLLED_REMOVAL_BATCH_ARTIFACT_STATUS_IDS.READY);
    expect(artifact.ready).toBe(true);
    expect(artifact.validation.ok).toBe(true);
    expect(artifact.executionGate.allowControlledDeletion).toBe(true);
    expect(artifact.removalBatch.statusId)
      .toBe(POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_STATUS_IDS
        .READY_FOR_REMOVAL_REVIEW);
    expect(artifact.removalBatch.removalBatch).toEqual(expect.objectContaining({
      selectedCount: 1,
      requestedPathCount: 1,
      maxBatchSize: 1,
      reviewedBy: 'phase8r-maintainer',
    }));
    expect(artifact.removalBatch.removalBatch.entries[0]).toEqual(expect.objectContaining({
      path: MANIFEST_PATH,
    }));
    expect(Object.values(artifact.sideEffects).some(Boolean)).toBe(false);
  });

  test('blocks when execution gate evidence is not ready', () => {
    const artifact = buildPolicyBuilderPhase8ControlledRemovalBatchArtifact({
      executionPlan: executionPlan(),
      input: readyInput({
        operatorApproval: {
          approved: false,
          approvedBy: null,
        },
      }),
    });

    expect(artifact.statusId)
      .toBe(PHASE8R_CONTROLLED_REMOVAL_BATCH_ARTIFACT_STATUS_IDS.BLOCKED);
    expect(artifact.ready).toBe(false);
    expect(artifact.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: PHASE8R_CONTROLLED_REMOVAL_BATCH_ARTIFACT_RISK_IDS
          .EXECUTION_GATE_NOT_READY,
      }),
    ]));
  });

  test('blocks when selected path is outside the approved manifest', () => {
    const artifact = buildPolicyBuilderPhase8ControlledRemovalBatchArtifact({
      executionPlan: executionPlan(),
      input: readyInput({
        selectedPaths: ['server/src/services/notInManifest.mjs'],
      }),
    });

    expect(artifact.statusId)
      .toBe(PHASE8R_CONTROLLED_REMOVAL_BATCH_ARTIFACT_STATUS_IDS.BLOCKED);
    expect(artifact.removalBatch.readyForRemovalReview).toBe(false);
    expect(artifact.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: PHASE8R_CONTROLLED_REMOVAL_BATCH_ARTIFACT_RISK_IDS
          .REMOVAL_BATCH_NOT_READY,
      }),
    ]));
  });

  test('rejects artifact side-effect claims', () => {
    const artifact = buildPolicyBuilderPhase8ControlledRemovalBatchArtifact({
      executionPlan: executionPlan(),
      input: readyInput(),
      sideEffects: {
        filesDeleted: true,
        storageChanged: true,
        gitCommandsRun: true,
      },
    });

    expect(artifact.statusId)
      .toBe(PHASE8R_CONTROLLED_REMOVAL_BATCH_ARTIFACT_STATUS_IDS.BLOCKED);
    expect(artifact.risks.map(risk => risk.riskId)).toEqual(expect.arrayContaining([
      PHASE8R_CONTROLLED_REMOVAL_BATCH_ARTIFACT_RISK_IDS.SIDE_EFFECT_REPORTED,
    ]));
    expect(artifact.validation.ok).toBe(false);
  });

  test('validates artifact invariants', () => {
    const artifact = buildPolicyBuilderPhase8ControlledRemovalBatchArtifact({
      executionPlan: executionPlan(),
      input: readyInput(),
    });
    const validation = validatePolicyBuilderPhase8ControlledRemovalBatchArtifact({
      ...artifact,
      statusId: 'unknown',
      riskCount: 99,
    });

    expect(validation.ok).toBe(false);
    expect(validation.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      PHASE8R_CONTROLLED_REMOVAL_BATCH_ARTIFACT_RISK_IDS.UNKNOWN_STATUS,
      PHASE8R_CONTROLLED_REMOVAL_BATCH_ARTIFACT_RISK_IDS.RISK_COUNT_MISMATCH,
    ]));
  });
});
