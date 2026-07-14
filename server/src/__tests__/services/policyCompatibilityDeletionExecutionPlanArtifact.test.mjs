import {
  POLICY_COMPATIBILITY_DELETION_CATEGORY_IDS,
  POLICY_COMPATIBILITY_DELETION_GATES_VERSION,
} from '../../services/policyCompatibilityDeletionGates.mjs';
import {
  POLICY_COMPATIBILITY_DELETION_CURRENT_INVENTORY_STATUS_IDS,
  POLICY_COMPATIBILITY_DELETION_CURRENT_INVENTORY_VERSION,
} from '../../services/policyCompatibilityDeletionCurrentInventory.mjs';
import {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_STATUS_IDS,
  buildPolicyCompatibilityDeletionExecutionPlanEvidenceBundle,
} from '../../services/policyCompatibilityDeletionExecutionPlanEvidenceBundle.mjs';
import {
  POLICY_NATIVE_RUNTIME_CUTOVER_STATUS_IDS,
  POLICY_NATIVE_RUNTIME_CUTOVER_VERIFICATION_VERSION,
} from '../../services/policyNativeRuntimeCutoverVerification.mjs';
import {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_STATUS_IDS,
} from '../../services/policyCompatibilityDeletionExecutionPlan.mjs';
import {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_ARTIFACT_RISK_IDS,
  POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_ARTIFACT_STATUS_IDS,
  buildPolicyCompatibilityDeletionExecutionPlanArtifact,
  validatePolicyCompatibilityDeletionExecutionPlanArtifact,
} from '../../services/policyCompatibilityDeletionExecutionPlanArtifact.mjs';

const MANIFEST_PATH =
  'client/src/components/policies/PolicyStarterTemplateMechanics.vue';

const COLLECTION_TIME = '2026-07-14T20:00:00.000Z';

function readyEvidenceBundle() {
  return buildPolicyCompatibilityDeletionExecutionPlanEvidenceBundle({
    currentPolicyInventory: {
      version: POLICY_COMPATIBILITY_DELETION_CURRENT_INVENTORY_VERSION,
      generatedAt: COLLECTION_TIME,
      statusId:
        POLICY_COMPATIBILITY_DELETION_CURRENT_INVENTORY_STATUS_IDS
          .ALL_ENABLED_POLICIES_NATIVE,
      allEnabledPoliciesNative: true,
      policyCounts: {
        unconvertedPolicyCount: 0,
      },
      validation: {
        ok: true,
      },
    },
    cutoverVerification: {
      version: POLICY_NATIVE_RUNTIME_CUTOVER_VERIFICATION_VERSION,
      generatedAt: COLLECTION_TIME,
      statusId:
        POLICY_NATIVE_RUNTIME_CUTOVER_STATUS_IDS.READY_FOR_CUTOVER_MONITORING,
      validation: {
        ok: true,
      },
    },
    deletionGatePlan: {
      version: POLICY_COMPATIBILITY_DELETION_GATES_VERSION,
      generatedAt: COLLECTION_TIME,
      statusId: 'ready_to_delete',
      readyToDelete: true,
      unconvertedPolicyCount: 0,
      categories: [{
        categoryId: POLICY_COMPATIBILITY_DELETION_CATEGORY_IDS.CLIENT_BRIDGE_UI,
        paths: [MANIFEST_PATH],
        deletionIntent: 'Delete bridge-only UI after native replacement.',
      }],
      blockers: [],
      validation: {
        ok: true,
      },
    },
    backupRestoreVerified: true,
    rollbackSupportVerified: true,
    supportDiagnosticsVerified: true,
    deletionManifestApproved: true,
    generatedAt: COLLECTION_TIME,
    now: COLLECTION_TIME,
  });
}

function readyInput(overrides = {}) {
  return {
    evidenceBundle: readyEvidenceBundle(),
    replacementEvidence: {
      [POLICY_COMPATIBILITY_DELETION_CATEGORY_IDS.CLIENT_BRIDGE_UI]: {
        replacement: 'Native policy builder destination context replaces this UI.',
        tests: ['PolicyBuilderLibraryContext.test.js'],
      },
    },
    rollbackStance:
      'Rollback snapshots remain available until the approved post-window stance.',
    supportStance:
      'Converted native policies use bounded support diagnostics after deletion.',
    manifestApproved: true,
    approvedBy: 'storage-closure-maintainer',
    ...overrides,
  };
}

describe('policyCompatibilityDeletionExecutionPlanArtifact', () => {
  test('builds a ready execution-plan artifact from explicit input evidence', () => {
    const artifact = buildPolicyCompatibilityDeletionExecutionPlanArtifact({
      input: readyInput(),
      generatedAt: '2026-07-01T00:00:00.000Z',
    });

    expect(artifact.statusId).toBe(POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_ARTIFACT_STATUS_IDS.READY);
    expect(artifact.ready).toBe(true);
    expect(artifact.validation.ok).toBe(true);
    expect(artifact.evidenceBundle.statusId)
      .toBe(POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_STATUS_IDS.READY);
    expect(artifact.executionPlan.statusId)
      .toBe(POLICY_COMPATIBILITY_DELETION_EXECUTION_STATUS_IDS
        .READY_FOR_EXECUTION_GATE);
    expect(artifact.executionPlan.manifest).toEqual(expect.objectContaining({
      approved: true,
      approvedBy: 'storage-closure-maintainer',
      entryCount: 1,
    }));
    expect(artifact.executionPlan.manifest.entries[0]).toEqual(expect.objectContaining({
      path: MANIFEST_PATH,
      ready: true,
    }));
    expect(Object.values(artifact.sideEffects).some(Boolean)).toBe(false);
  });

  test('blocks artifact readiness when approval evidence is missing', () => {
    const artifact = buildPolicyCompatibilityDeletionExecutionPlanArtifact({
      input: readyInput({
        manifestApproved: false,
        approvedBy: null,
      }),
    });

    expect(artifact.statusId).toBe(POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_ARTIFACT_STATUS_IDS.BLOCKED);
    expect(artifact.ready).toBe(false);
    expect(artifact.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_ARTIFACT_RISK_IDS.EXECUTION_PLAN_NOT_READY,
      }),
    ]));
  });

  test('blocks artifact output when the current evidence bundle is missing', () => {
    const input = readyInput();
    delete input.evidenceBundle;

    const artifact = buildPolicyCompatibilityDeletionExecutionPlanArtifact({ input });

    expect(artifact.statusId).toBe(POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_ARTIFACT_STATUS_IDS.BLOCKED);
    expect(artifact.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_ARTIFACT_RISK_IDS
            .EVIDENCE_BUNDLE_MISSING,
      }),
    ]));
  });

  test('rejects artifact side-effect claims', () => {
    const artifact = buildPolicyCompatibilityDeletionExecutionPlanArtifact({
      input: readyInput(),
      sideEffects: {
        filesDeleted: true,
        storageChanged: true,
        gitCommandsRun: true,
      },
    });

    expect(artifact.statusId).toBe(POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_ARTIFACT_STATUS_IDS.BLOCKED);
    expect(artifact.risks.map(risk => risk.riskId)).toEqual(expect.arrayContaining([
      POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_ARTIFACT_RISK_IDS.SIDE_EFFECT_REPORTED,
    ]));
    expect(artifact.validation.ok).toBe(false);
  });

  test('validates artifact invariants', () => {
    const artifact = buildPolicyCompatibilityDeletionExecutionPlanArtifact({
      input: readyInput(),
    });
    const validation = validatePolicyCompatibilityDeletionExecutionPlanArtifact({
      ...artifact,
      statusId: 'unknown',
      riskCount: 999,
    });

    expect(validation.ok).toBe(false);
    expect(validation.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_ARTIFACT_RISK_IDS.UNKNOWN_STATUS,
      POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_ARTIFACT_RISK_IDS.RISK_COUNT_MISMATCH,
    ]));
  });
});
