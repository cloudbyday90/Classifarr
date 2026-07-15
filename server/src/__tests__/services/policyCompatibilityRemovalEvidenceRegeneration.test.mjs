import {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_VERSION,
  POLICY_COMPATIBILITY_DELETION_EXECUTION_STATUS_IDS,
} from '../../services/policyCompatibilityDeletionExecutionPlan.mjs';
import {
  POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS,
} from '../../services/policyControlledCompatibilityPathRemovalApply.mjs';
import {
  POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_STATUS_IDS,
} from '../../services/policyCompatibilityRemovalCompletionAuditArtifact.mjs';
import {
  POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_RISK_IDS,
} from '../../services/policyCompatibilityRemovalCompletionAudit.mjs';
import {
  POLICY_COMPATIBILITY_REMOVAL_EVIDENCE_REGENERATION_RISK_IDS,
  POLICY_COMPATIBILITY_REMOVAL_EVIDENCE_REGENERATION_VERSION,
  buildPolicyCompatibilityRemovalEvidenceRegeneration,
} from '../../services/policyCompatibilityRemovalEvidenceRegeneration.mjs';
import {
  buildPolicyNextCompatibilityRemovalBatchAuthorizationArtifact,
} from '../../services/policyNextCompatibilityRemovalBatchAuthorizationArtifact.mjs';
import {
  buildPolicyPostRemovalRuntimeEvidenceArtifact,
} from '../../services/policyPostRemovalRuntimeEvidenceArtifact.mjs';
import {
  buildNextBatchAuthorizationPathStateSource,
} from './fixtures/policyNextCompatibilityRemovalBatchAuthorizationFixtures.mjs';

const MANIFEST_PATHS = Object.freeze([
  'server/src/services/retiredCompatibilityService.mjs',
  'client/src/components/RetiredCompatibilityPanel.vue',
]);
const REVIEW_ARTIFACT_FINGERPRINT = 'a'.repeat(64);

function executionPlan(overrides = {}) {
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
      approvedBy: 'policy-maintainer',
      entryCount: MANIFEST_PATHS.length,
      entries: MANIFEST_PATHS.map(path => ({
        categoryId: 'client_bridge_ui',
        actionId: 'delete_file',
        path,
        replacementEvidence: {
          replacementPath: 'server/src/services/policyNativeIntentProjection.mjs',
        },
        ready: true,
      })),
    },
    ...overrides,
  };
}

function validationEvidence() {
  return {
    focused: {
      command: 'focused checks',
      passed: true,
    },
    full: {
      command: 'npm --prefix server test',
      passed: true,
    },
  };
}

function referenceScan(overrides = {}) {
  return {
    completed: true,
    checkedPaths: MANIFEST_PATHS,
    references: [],
    ...overrides,
  };
}

function runtimeEvidenceArtifact(appliedPaths = MANIFEST_PATHS) {
  return buildPolicyPostRemovalRuntimeEvidenceArtifact({
    applyEvidence: {
      statusId: POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS.APPLIED,
      applied: true,
      validation: { ok: true, issueCount: 0, issues: [] },
      removalReview: { reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT },
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

async function nextBatchAuthorizationArtifact({
  plan = executionPlan(),
  appliedPaths = MANIFEST_PATHS,
} = {}) {
  const remainingPaths = MANIFEST_PATHS.filter(path => !appliedPaths.includes(path));
  const source = buildNextBatchAuthorizationPathStateSource({
    executionPlan: plan,
    existingPaths: remainingPaths,
  });

  return buildPolicyNextCompatibilityRemovalBatchAuthorizationArtifact({
    runtimeEvidenceArtifact: runtimeEvidenceArtifact(appliedPaths),
    ...source,
    input: {
      requestedPaths: remainingPaths,
      maxBatchSize: MANIFEST_PATHS.length,
      authorizationReason: remainingPaths.length > 0
        ? 'Continue the reviewed compatibility removal loop.'
        : '',
      authorizedBy: remainingPaths.length > 0 ? 'policy-maintainer' : '',
      reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
    },
    generatedAt: '2026-07-14T10:00:00.000Z',
  });
}

describe('policyCompatibilityRemovalEvidenceRegeneration', () => {
  test('regenerates a complete current artifact from a current plan and repository state', async () => {
    const plan = executionPlan();
    const evidence = await buildPolicyCompatibilityRemovalEvidenceRegeneration({
      executionPlan: plan,
      nextBatchAuthorizationArtifact: await nextBatchAuthorizationArtifact({ plan }),
      reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
      validationEvidence: validationEvidence(),
      referenceScan: referenceScan(),
      fileExists: () => false,
      generatedAt: '2026-07-14T18:00:00.000Z',
    });

    expect(evidence.version)
      .toBe(POLICY_COMPATIBILITY_REMOVAL_EVIDENCE_REGENERATION_VERSION);
    expect(evidence.statusId)
      .toBe(POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_STATUS_IDS
        .COMPLETE);
    expect(evidence.complete).toBe(true);
    expect(evidence.pathState).toEqual(expect.objectContaining({
      existingCount: 0,
      removedCount: MANIFEST_PATHS.length,
    }));
    expect(evidence.completionAuditArtifact.complete).toBe(true);
    expect(evidence.validation.ok).toBe(true);
  });

  test('reports current remaining inventory without manufacturing a completion result', async () => {
    const plan = executionPlan();
    const evidence = await buildPolicyCompatibilityRemovalEvidenceRegeneration({
      executionPlan: plan,
      nextBatchAuthorizationArtifact: await nextBatchAuthorizationArtifact({
        plan,
        appliedPaths: [MANIFEST_PATHS[1]],
      }),
      reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
      validationEvidence: validationEvidence(),
      referenceScan: referenceScan(),
      fileExists: path => path === MANIFEST_PATHS[0],
    });

    expect(evidence.statusId)
      .toBe(POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_STATUS_IDS
        .REMAINING_INVENTORY);
    expect(evidence.complete).toBe(false);
    expect(evidence.pathState).toEqual(expect.objectContaining({
      existingPaths: [MANIFEST_PATHS[0]],
      removedPaths: [MANIFEST_PATHS[1]],
    }));
    expect(evidence.nextStep.stepId)
      .toBe('policy_compatibility_deletion_readiness');
  });

  test('rejects a predecessor execution-plan contract even when all paths are absent', async () => {
    const plan = executionPlan({
        version: 'phase8r.compatibility_path_deletion_execution_plan.v1',
      });
    const evidence = await buildPolicyCompatibilityRemovalEvidenceRegeneration({
      executionPlan: plan,
      nextBatchAuthorizationArtifact: await nextBatchAuthorizationArtifact({ plan }),
      reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
      validationEvidence: validationEvidence(),
      referenceScan: referenceScan(),
      fileExists: () => false,
    });

    expect(evidence.statusId)
      .toBe(POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_STATUS_IDS
        .BLOCKED);
    expect(evidence.complete).toBe(false);
    expect(evidence.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_RISK_IDS
            .EXECUTION_PLAN_VERSION_UNSUPPORTED,
        expectedVersion: POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_VERSION,
      }),
    ]));
  });

  test('requires a completed current-source reference scan', async () => {
    const plan = executionPlan();
    const evidence = await buildPolicyCompatibilityRemovalEvidenceRegeneration({
      executionPlan: plan,
      nextBatchAuthorizationArtifact: await nextBatchAuthorizationArtifact({ plan }),
      reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
      validationEvidence: validationEvidence(),
      referenceScan: referenceScan({
        completed: false,
        checkedPaths: [],
      }),
      fileExists: () => false,
    });

    expect(evidence.complete).toBe(false);
    expect(evidence.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          POLICY_COMPATIBILITY_REMOVAL_EVIDENCE_REGENERATION_RISK_IDS
            .SOURCE_SCAN_INCOMPLETE,
      }),
    ]));
  });
});
