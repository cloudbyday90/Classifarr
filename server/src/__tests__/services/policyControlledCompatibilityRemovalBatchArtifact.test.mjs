import {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_ACTION_IDS,
  POLICY_COMPATIBILITY_DELETION_EXECUTION_STATUS_IDS,
} from '../../services/policyCompatibilityDeletionExecutionPlan.mjs';
import {
  POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_STATUS_IDS,
} from '../../services/policyControlledCompatibilityPathRemoval.mjs';
import {
  POLICY_CONTROLLED_COMPATIBILITY_REMOVAL_BATCH_ARTIFACT_RISK_IDS,
  POLICY_CONTROLLED_COMPATIBILITY_REMOVAL_BATCH_ARTIFACT_STATUS_IDS,
  buildPolicyControlledCompatibilityRemovalBatchArtifact,
  validatePolicyControlledCompatibilityRemovalBatchArtifact,
} from '../../services/policyControlledCompatibilityRemovalBatchArtifact.mjs';
import {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_TEST_TIME,
  buildReadyExecutionGateOperatorEvidence,
  buildReadyExecutionGatePreflightEvidenceArtifact,
  buildReadyExecutionPlanArtifact,
} from './fixtures/policyCompatibilityDeletionExecutionGateFixtures.mjs';

const MANIFEST_PATH =
  'client/src/components/policies/PolicyStarterTemplateAccelerator.vue';

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
      approvedBy: 'storage-closure-maintainer',
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

function readyExecutionPlanArtifact(overrides = {}) {
  return buildReadyExecutionPlanArtifact({
    executionPlan: executionPlan(),
    overrides,
  });
}

function readyInput({ executionPlanArtifact, overrides = {} } = {}) {
  return {
    operatorEvidence: buildReadyExecutionGateOperatorEvidence({
      executionPlanArtifact,
    }),
    preflightEvidenceArtifact: buildReadyExecutionGatePreflightEvidenceArtifact({
      executionPlanArtifact,
    }),
    selectedPaths: [MANIFEST_PATH],
    maxBatchSize: 1,
    removalReason:
      'First controlled batch removes one bridge-only UI file from the approved manifest.',
    reviewedBy: 'storage-closure-maintainer',
    ...overrides,
  };
}

function buildReadyBatchArtifact({
  executionPlanArtifact = readyExecutionPlanArtifact(),
  input = null,
  ...overrides
} = {}) {
  return buildPolicyControlledCompatibilityRemovalBatchArtifact({
    executionPlanArtifact,
    input: input || readyInput({ executionPlanArtifact }),
    generatedAt: POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_TEST_TIME,
    now: POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_TEST_TIME,
    ...overrides,
  });
}

describe('policyControlledCompatibilityRemovalBatchArtifact', () => {
  test('builds a ready controlled removal batch artifact', () => {
    const artifact = buildReadyBatchArtifact();

    expect(artifact.statusId)
      .toBe(POLICY_CONTROLLED_COMPATIBILITY_REMOVAL_BATCH_ARTIFACT_STATUS_IDS.READY);
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
      reviewedBy: 'storage-closure-maintainer',
    }));
    expect(artifact.removalBatch.removalBatch.entries[0]).toEqual(expect.objectContaining({
      path: MANIFEST_PATH,
    }));
    expect(Object.values(artifact.sideEffects).some(Boolean)).toBe(false);
  });

  test('blocks when execution gate evidence is not ready', () => {
    const executionPlanArtifact = readyExecutionPlanArtifact();
    const artifact = buildReadyBatchArtifact({
      executionPlanArtifact,
      input: readyInput({
        executionPlanArtifact,
        overrides: {
          operatorEvidence: buildReadyExecutionGateOperatorEvidence({
            executionPlanArtifact,
            overrides: { approval: { approved: false, approvedBy: null } },
          }),
        },
      }),
    });

    expect(artifact.statusId)
      .toBe(POLICY_CONTROLLED_COMPATIBILITY_REMOVAL_BATCH_ARTIFACT_STATUS_IDS.BLOCKED);
    expect(artifact.ready).toBe(false);
    expect(artifact.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_CONTROLLED_COMPATIBILITY_REMOVAL_BATCH_ARTIFACT_RISK_IDS
          .EXECUTION_GATE_NOT_READY,
      }),
    ]));
  });

  test('blocks when selected path is outside the approved manifest', () => {
    const executionPlanArtifact = readyExecutionPlanArtifact();
    const artifact = buildReadyBatchArtifact({
      executionPlanArtifact,
      input: readyInput({
        executionPlanArtifact,
        overrides: { selectedPaths: ['server/src/services/notInManifest.mjs'] },
      }),
    });

    expect(artifact.statusId)
      .toBe(POLICY_CONTROLLED_COMPATIBILITY_REMOVAL_BATCH_ARTIFACT_STATUS_IDS.BLOCKED);
    expect(artifact.removalBatch.readyForRemovalReview).toBe(false);
    expect(artifact.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_CONTROLLED_COMPATIBILITY_REMOVAL_BATCH_ARTIFACT_RISK_IDS
          .REMOVAL_BATCH_NOT_READY,
      }),
    ]));
  });

  test('rejects artifact side-effect claims', () => {
    const artifact = buildReadyBatchArtifact({
      sideEffects: {
        filesDeleted: true,
        storageChanged: true,
        gitCommandsRun: true,
      },
    });

    expect(artifact.statusId)
      .toBe(POLICY_CONTROLLED_COMPATIBILITY_REMOVAL_BATCH_ARTIFACT_STATUS_IDS.BLOCKED);
    expect(artifact.risks.map(risk => risk.riskId)).toEqual(expect.arrayContaining([
      POLICY_CONTROLLED_COMPATIBILITY_REMOVAL_BATCH_ARTIFACT_RISK_IDS.SIDE_EFFECT_REPORTED,
    ]));
    expect(artifact.validation.ok).toBe(false);
  });

  test('validates artifact invariants', () => {
    const artifact = buildReadyBatchArtifact();
    const validation = validatePolicyControlledCompatibilityRemovalBatchArtifact({
      ...artifact,
      statusId: 'unknown',
      riskCount: 99,
    });

    expect(validation.ok).toBe(false);
    expect(validation.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      POLICY_CONTROLLED_COMPATIBILITY_REMOVAL_BATCH_ARTIFACT_RISK_IDS.UNKNOWN_STATUS,
      POLICY_CONTROLLED_COMPATIBILITY_REMOVAL_BATCH_ARTIFACT_RISK_IDS.RISK_COUNT_MISMATCH,
    ]));
  });

  test('does not accept legacy caller-asserted readiness fields without an artifact', () => {
    const artifact = buildPolicyControlledCompatibilityRemovalBatchArtifact({
      input: {
        worktreeClean: true,
        backupRestoreVerified: true,
        backupRestoreFresh: true,
        manifestFresh: true,
        manifestMatchesCurrentPlan: true,
        selectedPaths: [MANIFEST_PATH],
        maxBatchSize: 1,
        removalReason: 'Legacy readiness fields must not bypass artifact binding.',
        reviewedBy: 'storage-closure-maintainer',
      },
      generatedAt: POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_TEST_TIME,
      now: POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_TEST_TIME,
    });

    expect(artifact.ready).toBe(false);
    expect(artifact.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_CONTROLLED_COMPATIBILITY_REMOVAL_BATCH_ARTIFACT_RISK_IDS
          .EXECUTION_PLAN_ARTIFACT_NOT_READY,
      }),
    ]));
  });
});
