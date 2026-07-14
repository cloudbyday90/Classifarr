import {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_VERSION,
  POLICY_COMPATIBILITY_DELETION_EXECUTION_STATUS_IDS,
} from '../../services/policyCompatibilityDeletionExecutionPlan.mjs';
import {
  POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS,
} from '../../services/policyControlledCompatibilityPathRemovalApply.mjs';
import {
  POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_RISK_IDS,
  POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_STATUS_IDS,
  buildPolicyCompatibilityRemovalCompletionAuditArtifact,
  validatePolicyCompatibilityRemovalCompletionAuditArtifact,
} from '../../services/policyCompatibilityRemovalCompletionAuditArtifact.mjs';
import {
  buildPolicyNextCompatibilityRemovalBatchAuthorizationArtifact,
} from '../../services/policyNextCompatibilityRemovalBatchAuthorizationArtifact.mjs';
import {
  buildPolicyPostRemovalRuntimeEvidenceArtifact,
} from '../../services/policyPostRemovalRuntimeEvidenceArtifact.mjs';

const REVIEW_ARTIFACT_FINGERPRINT = 'a'.repeat(64);
const MANIFEST_PATHS = Object.freeze([
  'client/src/components/policies/PolicyStarterTemplateMechanics.vue',
  'server/src/services/policyIntentImpactPreview.mjs',
  'server/src/services/policyIntentReplayPreview.mjs',
]);

function executionPlan() {
  const entries = MANIFEST_PATHS.map(path => ({
    categoryId: 'old_preview_replay_diagnostics',
    actionId: 'delete_file',
    path,
    ready: true,
  }));

  return {
    version: POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_VERSION,
    statusId:
      POLICY_COMPATIBILITY_DELETION_EXECUTION_STATUS_IDS.READY_FOR_EXECUTION_GATE,
    readyForExecutionGate: true,
    validation: { ok: true, issueCount: 0, issues: [] },
    manifest: {
      approved: true,
      entryCount: entries.length,
      entries,
    },
  };
}

function runtimeEvidenceArtifact(appliedPaths = MANIFEST_PATHS) {
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
        results: appliedPaths.map(path => ({ path, actionId: 'delete_file', applied: true })),
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

  return buildPolicyNextCompatibilityRemovalBatchAuthorizationArtifact({
    runtimeEvidenceArtifact: runtimeEvidenceArtifact(appliedPaths),
    executionPlan: plan,
    input: {
      requestedPaths: remainingPaths,
      maxBatchSize: 3,
      authorizationReason: remainingPaths.length > 0
        ? 'Continue the reviewed compatibility removal loop.'
        : '',
      authorizedBy: remainingPaths.length > 0 ? 'policy-maintainer' : '',
      reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
    },
    generatedAt: '2026-07-14T10:00:00.000Z',
  });
}

function input(overrides = {}) {
  return {
    reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
    finalImportScan: {
      completed: true,
      checkedPaths: MANIFEST_PATHS,
      references: [],
    },
    validationEvidence: {
      focused: { command: 'focused phase8r checks', passed: true },
      full: { command: 'npm --prefix server test', passed: true },
    },
    ...overrides,
  };
}

describe('policyCompatibilityRemovalCompletionAuditArtifact', () => {
  test('wraps a complete artifact-bound compatibility-removal completion audit', async () => {
    const plan = executionPlan();
    const authorizationArtifact = await nextBatchAuthorizationArtifact({ plan });
    const artifact = await buildPolicyCompatibilityRemovalCompletionAuditArtifact({
      nextBatchAuthorizationArtifact: authorizationArtifact,
      executionPlan: plan,
      input: input(),
      generatedAt: '2026-07-14T11:00:00.000Z',
    });

    expect(artifact.statusId)
      .toBe(POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_STATUS_IDS
        .COMPLETE);
    expect(artifact.complete).toBe(true);
    expect(artifact.remainingInventory).toBe(false);
    expect(artifact.validation.ok).toBe(true);
    expect(artifact.artifactFingerprint).toEqual(expect.objectContaining({
      algorithm: 'sha256',
      fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
    }));
    expect(artifact.executionPlan).toEqual(plan);
    expect(artifact.auditInput).toEqual(input());
    expect(artifact.nextBatchAuthorizationArtifact).toBe(authorizationArtifact);
    expect(artifact.audit.authorizationArtifact).toEqual(expect.objectContaining({
      integrityOk: true,
      reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
    }));
    expect(artifact.auditSummary).toEqual({
      manifestTotalCount: 3,
      manifestRemovedCount: 3,
      manifestRemainingCount: 0,
      removalVerificationCount: 1,
      removalVerifiedCount: 1,
      finalScanReferenceCount: 0,
    });
  });

  test('wraps intact remaining-inventory output without treating it as corruption', async () => {
    const plan = executionPlan();
    const authorizationArtifact = await nextBatchAuthorizationArtifact({
      plan,
      appliedPaths: [MANIFEST_PATHS[0]],
    });
    const artifact = await buildPolicyCompatibilityRemovalCompletionAuditArtifact({
      nextBatchAuthorizationArtifact: authorizationArtifact,
      executionPlan: plan,
      input: input(),
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

  test('blocks an altered authorization artifact and a final scan reference', async () => {
    const plan = executionPlan();
    const authorizationArtifact = await nextBatchAuthorizationArtifact({ plan });
    const alteredAuthorizationArtifact = structuredClone(authorizationArtifact);
    alteredAuthorizationArtifact.authorizationSummary.remainingCount = 1;
    const altered = await buildPolicyCompatibilityRemovalCompletionAuditArtifact({
      nextBatchAuthorizationArtifact: alteredAuthorizationArtifact,
      executionPlan: plan,
      input: input(),
    });
    const referenced = await buildPolicyCompatibilityRemovalCompletionAuditArtifact({
      nextBatchAuthorizationArtifact: authorizationArtifact,
      executionPlan: plan,
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

    [altered, referenced].forEach(artifact => {
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
    });
    expect(altered.audit.statusId).toBe('blocked_by_authorization_artifact');
    expect(referenced.audit.statusId).toBe('blocked_by_final_scan');
  });

  test('rejects side effects in artifact output', async () => {
    const plan = executionPlan();
    const artifact = await buildPolicyCompatibilityRemovalCompletionAuditArtifact({
      nextBatchAuthorizationArtifact: await nextBatchAuthorizationArtifact({ plan }),
      executionPlan: plan,
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
    ]));
  });

  test('validates status and risk-count invariants', () => {
    const validation = validatePolicyCompatibilityRemovalCompletionAuditArtifact({
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
